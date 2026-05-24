import { randomBytes } from 'crypto'
import { encodeBase32 } from './base32.js'

/** 20 bytes → ~32 Base32 chars; matches common authenticator defaults. */
const DEFAULT_BYTE_LENGTH = 20

/**
 * Create a cryptographically random TOTP shared secret (Base32).
 * Consumers persist this via StorageAdapter during enroll().
 */
export function generateSecret(options?: { length?: number }): string {
  const byteLength = options?.length ?? DEFAULT_BYTE_LENGTH
  // RFC 4226 recommends at least 128 bits (16 bytes) of entropy for the secret.
  if (byteLength < 16) {
    throw new Error('Secret length must be at least 16 bytes')
  }
  return encodeBase32(randomBytes(byteLength))
}
