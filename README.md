# totp-auth

Self-hostable TOTP MFA library for Node.js. Handles enrollment, verification, and single-use recovery codes — not full authentication (no sessions or JWTs).

Your app owns primary login, sessions, and JWTs. This library only handles the **MFA step**: enroll, confirm, verify, revoke, and backup codes.

---

## Requirements

- **Node.js 18+**
- A **database** (or other store) where you implement `StorageAdapter`
- **Server-side only** — do not bundle `TOTPService` or secrets into a browser/React client

---

## Install

Coming soon on npm. For now, clone and link locally:

```bash
git clone https://github.com/ameyaaklekar/totp-auth-service.git
cd topt-auth-service
npm install
npm run build
```

Link into another project while developing:

```bash
npm link
# in your app directory:
npm link totp-auth
```

---

## Setup guide

### 1. Create a server-side `TOTPService` instance

Instantiate once per process (or per request with a shared adapter) in your Node API layer — Express, Fastify, Next.js Route Handlers, etc.

```typescript
// lib/totp.ts
import { TOTPService, TotpAlgorithm } from 'totp-auth'
import { myStorageAdapter } from './totp-storage.js'

export const totp = new TOTPService({
  storage: myStorageAdapter,
  issuer: 'MyApp',              // shown in authenticator apps
  digits: 6,                    // 6 or 8 (default: 6)
  period: 30,                   // seconds (default: 30)
  algorithm: TotpAlgorithm.SHA1,
  window: 1,                    // ±1 period clock drift (default: 1)
  recoveryCodeCount: 10,        // backup codes on confirm (default: 10)
})
```

### 2. Implement `StorageAdapter`

The library does not ship database adapters. Implement the interface for Postgres, Redis, MongoDB, Supabase, etc.

**Tables (conceptual):**

| Table / collection | Fields |
|--------------------|--------|
| `totp_enrollments` | `userId`, `secret` (Base32), `status`, `createdAt`, `confirmedAt`, `revokedAt` |
| `totp_recovery_codes` | `userId`, `codeHash` (SHA-256 hex), `usedAt` |

**Contracts:**

- `saveEnrollment` — upsert by `userId`
- `getEnrollment` — return `null` if missing (do not throw)
- `getRecoveryCodes` — return `[]` if none
- Only **hashed** recovery codes are stored; plaintext is returned once from `confirm()` / `regenerateRecoveryCodes()`
- Serialize concurrent writes per `userId` in your adapter (DB locks or atomic updates)

```typescript
import type { StorageAdapter, TOTPEnrollment, RecoveryCode } from 'totp-auth'

export const myStorageAdapter: StorageAdapter = {
  async saveEnrollment(enrollment) { /* upsert */ },
  async getEnrollment(userId) { /* ... */ },
  async updateEnrollment(userId, patch) { /* ... */ },
  async deleteEnrollment(userId) { /* ... */ },
  async saveRecoveryCodes(codes) { /* replace batch for user */ },
  async getRecoveryCodes(userId) { /* ... */ },
  async markRecoveryCodeUsed(userId, codeHash) { /* ... */ },
  async deleteRecoveryCodes(userId) { /* ... */ },
}
```

Use `MemoryAdapter` from `totp-auth/testing` only in tests — not in production.

### 3. Expose HTTP routes (your app)

The library has no built-in HTTP layer. Map methods to routes after the user is authenticated (session/JWT with `userId`).

| Route (example) | Method | `TOTPService` |
|-----------------|--------|----------------|
| `POST /api/mfa/enroll` | Start setup | `enroll(userId)` |
| `POST /api/mfa/confirm` | First code from app | `confirm(userId, code)` |
| `POST /api/mfa/verify` | Login MFA step | `verify(userId, code)` |
| `GET /api/mfa/status` | Settings UI | `getStatus(userId)` |
| `POST /api/mfa/revoke` | Disable 2FA | `revoke(userId)` |
| `POST /api/mfa/recovery/regenerate` | New backup codes | `regenerateRecoveryCodes(userId)` |
| `DELETE /api/user` (or similar) | Account deletion | `delete(userId)` |

**Example — enroll (Next.js Route Handler):**

```typescript
import { totp } from '@/lib/totp'
import { getSessionUserId } from '@/lib/auth'

export async function POST() {
  const userId = await getSessionUserId()
  const { otpAuthUri } = await totp.enroll(userId)
  return Response.json({ otpAuthUri })
}
```

**Example — verify after password login:**

```typescript
export async function POST(req: Request) {
  const userId = await getPartialLoginUserId()
  const { code } = await req.json()
  const result = await totp.verify(userId, code)
  if (!result.valid) {
    return Response.json({ valid: false }, { status: 401 })
  }
  await issueSession(userId) // your auth — not part of totp-auth
  return Response.json(result)
}
```

Map thrown errors to HTTP status + JSON `{ code: 'ENROLLMENT_NOT_FOUND' }` using `TOTPErrorCode` from `totp-auth`.

### 4. React (or any frontend)

React talks to **your API**, not to `TOTPService` directly.

1. **Enroll** — `POST /api/mfa/enroll` → render QR from `otpAuthUri` (e.g. `react-qr-code`).
2. **Confirm** — user enters 6-digit code → `POST /api/mfa/confirm` → show `recoveryCodes` once; user must save them.
3. **Login MFA** — after password step, show code input → `POST /api/mfa/verify` → on success, complete session in your API.

Never return the shared secret to the client in production if you can avoid it; `otpAuthUri` alone is enough for QR setup.

```tsx
// Client — fetch only, no totp-auth import
const res = await fetch('/api/mfa/enroll', { method: 'POST' })
const { otpAuthUri } = await res.json()
```

### 5. Enrollment state machine

```
[none | revoked] --enroll()--> pending --confirm()--> active --revoke()--> revoked
```

| Method | Allowed when |
|--------|----------------|
| `enroll()` | No row, or `revoked` |
| `confirm()` | `pending` |
| `verify()` | `active` |
| `revoke()` | `pending` or `active` |
| `regenerateRecoveryCodes()` | `active` |
| `delete()` | Always (no throw) |

Full API details: [Requirements.md](./Requirements.md).

---

## Quick start (Node script / tests)

```typescript
import { TOTPService, EnrollmentStatus, TOTPErrorCode } from 'totp-auth'
import { generateCode } from 'totp-auth/crypto'
import { MemoryAdapter } from 'totp-auth/testing'

const totp = new TOTPService({
  storage: new MemoryAdapter(),
  issuer: 'MyApp',
})

const userId = 'user-123'

const { secret, otpAuthUri } = await totp.enroll(userId)
console.log(otpAuthUri) // otpauth://totp/...

const { recoveryCodes } = await totp.confirm(userId, generateCode(secret))
console.log(recoveryCodes) // save once; not recoverable later

const { valid } = await totp.verify(userId, generateCode(secret))
console.log(valid) // true
```

---

## Development (this repository)

```bash
npm install
npm run build      # dist/ (CJS + ESM + .d.ts)
npm test           # unit + service tests
npm run test:watch
npm run typecheck
```

### Manual demo with QR code

Runs the full enroll → confirm → verify flow and prints a scannable QR (terminal + PNG):

```bash
npm run demo
```

- Terminal: ASCII QR from `otpauth://` URI
- File: `totp-qr.png` in the project root (open and scan with Google Authenticator, etc.)
- The script still uses `generateCode()` for confirm/verify so it finishes without typing a code; scan the QR only if you want to compare with a real app

---

## Entry points

| Import | Purpose |
|--------|---------|
| `totp-auth` | `TOTPService`, `StorageAdapter`, errors, enums |
| `totp-auth/crypto` | `generateSecret`, `buildOtpAuthUri`, `generateCode`, `verifyCode` |
| `totp-auth/testing` | `MemoryAdapter` (tests only) |

**Public enums:** `EnrollmentStatus`, `TotpAlgorithm`, `TOTPErrorCode`.

---

## License

MIT
