import { createHash, randomBytes } from 'crypto'
import type { RecoveryCode } from '../adapters/storage.js'

/** 5 bytes → 10 hex chars, formatted as XXXX-XXXX-XXXX for readability. */
const RECOVERY_CODE_BYTES = 5

/** SHA-256 hex digest; adapter stores only this, never plaintext codes. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex')
}

/**
 * Generate one-time backup codes. Plaintext is returned to the caller exactly once
 * (confirm / regenerateRecoveryCodes); only hashes are persisted.
 */
export function generateRecoveryCodes(
  userId: string,
  count: number,
): { plaintext: string[]; stored: RecoveryCode[] } {
  const plaintext: string[] = []
  const stored: RecoveryCode[] = []
  const seen = new Set<string>()

  while (plaintext.length < count) {
    const code = randomBytes(RECOVERY_CODE_BYTES)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,4}/g)!
      .join('-')

    if (seen.has(code)) continue
    seen.add(code)
    plaintext.push(code)
    stored.push({
      userId,
      codeHash: hashRecoveryCode(code),
      usedAt: null,
    })
  }

  return { plaintext, stored }
}

/** Match submitted backup code to an unused stored hash. */
export function findMatchingRecoveryCode(
  codes: RecoveryCode[],
  submittedCode: string,
): RecoveryCode | null {
  const hash = hashRecoveryCode(submittedCode)
  return (
    codes.find((c) => c.codeHash === hash && c.usedAt === null) ?? null
  )
}
