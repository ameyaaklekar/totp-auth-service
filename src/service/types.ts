import type { EnrollmentStatus } from '../enums/enrollment-status.js'
import type { TotpAlgorithm } from '../enums/totp-algorithm.js'

/** Returned from enroll(); secret + URI for QR / manual setup. */
export interface EnrollmentResult {
  secret: string
  otpAuthUri: string
}

/** Returned from confirm(); backup codes shown once, not stored in plaintext. */
export interface ConfirmResult {
  recoveryCodes: string[]
}

export interface VerifyResult {
  valid: boolean
  /** True when a backup code was consumed (single-use). */
  usedRecoveryCode: boolean
}

/** Public view of enrollment — intentionally excludes secret. */
export interface EnrollmentStatusView {
  userId: string
  status: EnrollmentStatus
  createdAt: Date
  confirmedAt: Date | null
  revokedAt: Date | null
}

export interface TOTPServiceConfig {
  storage: import('../adapters/storage.js').StorageAdapter
  /** Display name in authenticator apps (otpauth issuer param). */
  issuer: string
  digits?: 6 | 8
  period?: number
  algorithm?: TotpAlgorithm
  /** Clock drift tolerance in TOTP periods (default 1 → ±30s at 30s period). */
  window?: number
  recoveryCodeCount?: number
}
