/**
 * RFC 4226 (HOTP) and RFC 6238 (TOTP) — pure functions, no I/O.
 *
 * TOTP is HOTP with counter = floor(unixTime / period). Injectable `timestamp`
 * keeps tests deterministic without mocking Date or global time.
 */
import { createHmac } from 'crypto'
import { TotpAlgorithm } from '../enums/totp-algorithm.js'
import { decodeBase32 } from './base32.js'

export interface TotpOptions {
  period?: number
  digits?: number
  /** Defaults to Date.now(); pass in tests for fixed codes. */
  timestamp?: number
  algorithm?: TotpAlgorithm
}

export interface VerifyCodeOptions extends TotpOptions {
  /** Drift tolerance in 30s (or custom) periods — checks counter ± window. */
  window?: number
}

function algorithmToHashName(algorithm: TotpAlgorithm): string {
  switch (algorithm) {
    case TotpAlgorithm.SHA256:
      return 'sha256'
    case TotpAlgorithm.SHA512:
      return 'sha512'
    default:
      return 'sha1'
  }
}

/**
 * RFC 4226 §5.1: counter must be an 8-byte big-endian integer in the HMAC input.
 */
function counterToBuffer(counter: number): Buffer {
  const buf = Buffer.alloc(8)
  let value = counter
  for (let i = 7; i >= 0; i--) {
    buf[i] = value & 0xff
    value = Math.floor(value / 256)
  }
  return buf
}

/**
 * HMAC-based One-Time Password (RFC 4226).
 * TOTP calls this with a time-derived counter; verifyCode may call it for
 * neighboring counters when `window` > 0 (clock skew).
 */
function hotp(
  secret: Buffer,
  counter: number,
  digits: number,
  algorithm: TotpAlgorithm,
): string {
  const hmac = createHmac(algorithmToHashName(algorithm), secret)
  hmac.update(counterToBuffer(counter))
  const digest = hmac.digest()

  // Dynamic truncation (RFC 4226 §5.3): derive a 31-bit value from the HMAC digest.
  const offset = digest[digest.length - 1]! & 0x0f
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff)

  const otp = binary % 10 ** digits
  return otp.toString().padStart(digits, '0')
}

function resolveTimestamp(timestamp?: number): number {
  return timestamp ?? Date.now()
}

/** Generate the TOTP code for the current (or injected) time slice. */
export function generateCode(
  secret: string,
  options?: TotpOptions,
): string {
  const period = options?.period ?? 30
  const digits = options?.digits ?? 6
  const algorithm = options?.algorithm ?? TotpAlgorithm.SHA1
  const timestamp = resolveTimestamp(options?.timestamp)
  const counter = Math.floor(timestamp / 1000 / period)
  const key = decodeBase32(secret)
  return hotp(key, counter, digits, algorithm)
}

/**
 * Constant-time comparison is not used here; timing leaks on OTP verify are a
 * secondary concern vs. rate limiting (out of scope for v1). Returns false for
 * malformed input instead of throwing.
 */
export function verifyCode(
  secret: string,
  code: string,
  options?: VerifyCodeOptions,
): boolean {
  const period = options?.period ?? 30
  const digits = options?.digits ?? 6
  const window = options?.window ?? 0
  const algorithm = options?.algorithm ?? TotpAlgorithm.SHA1
  const timestamp = resolveTimestamp(options?.timestamp)
  const counter = Math.floor(timestamp / 1000 / period)
  const key = decodeBase32(secret)

  const normalized = code.replace(/\s/g, '')
  if (!/^\d+$/.test(normalized) || normalized.length !== digits) {
    return false
  }

  for (let drift = -window; drift <= window; drift++) {
    if (hotp(key, counter + drift, digits, algorithm) === normalized) {
      return true
    }
  }

  return false
}
