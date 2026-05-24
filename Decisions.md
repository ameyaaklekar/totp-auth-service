# Architecture Decision Records

## ADR-001: Service Role
**Decision:** TOTP-only MFA step handler — not a full auth service.

The library handles only the TOTP step in a larger auth flow. It does not own primary login, session management, or JWT issuance. The calling application orchestrates the overall auth lifecycle.

---

## ADR-002: Distribution Format
**Decision:** Open-source npm library, not a standalone HTTP service.

Consumers install via `npm install totp-auth` and integrate directly into their Node.js application. Self-hosting means running the consumer's own app — not a separate TOTP server to deploy and manage.

---

## ADR-003: Integration Surface
**Decision:** Service class / SDK style.

Public API is `new TOTPService(config)` with explicit method calls (`enroll()`, `confirm()`, `verify()`, `revoke()`). No HTTP coupling at the library level. Consumers wire it into their own routes, middleware, or handlers however they choose.

---

## ADR-004: Storage Strategy
**Decision:** Bring your own storage via `StorageAdapter` interface.

The library defines a `StorageAdapter` interface. Consumers implement it for their database (Postgres, Redis, MongoDB, etc.). The library ships a `MemoryAdapter` in the `/testing` entry point for use in tests only.

---

## ADR-005: v1 Feature Scope
**Decision:** Core TOTP + enrollment lifecycle + recovery codes.

In scope for v1:
- Secret generation
- OTP URI / QR code data generation
- Code verification with configurable window/drift tolerance
- Enrollment state machine: `pending → active → revoked`
- Single-use backup/recovery codes

Out of scope for v1:
- Rate limiting adapter (deferred to a future release)
- Built-in HTTP handlers or middleware
- Pre-built storage adapters (Postgres, Redis, etc.)

---

## ADR-006: TypeScript Configuration
**Decision:** Full TypeScript, types-first.

- Strict mode enabled, no `any` in public APIs
- Ships `.d.ts` declaration files
- Source written in TypeScript; compiled output is the published artifact

---

## ADR-007: Package Architecture
**Decision:** Single package with layered subpath exports.

One `npm install`, three public entry points via `package.json` `exports` map:

| Entry point | Contents |
|---|---|
| `totp-auth` | `TOTPService`, `StorageAdapter` interface, error types |
| `totp-auth/crypto` | Pure TOTP math functions (no I/O, no state) |
| `totp-auth/testing` | `MemoryAdapter` + test helpers (not for production) |

Rationale: monorepo (multiple scoped packages) was considered but is premature overhead for v1. Subpath exports give composability without multi-package versioning complexity.
