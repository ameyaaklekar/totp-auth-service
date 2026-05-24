import type { EnrollmentStatus } from '../enums/enrollment-status.js'

/**
 * Persistence contract — consumers implement StorageAdapter for their database.
 * The library hashes recovery codes before saveRecoveryCodes(); adapters never
 * see plaintext backup codes.
 */

/** Per-user TOTP enrollment record and lifecycle state. */
export interface TOTPEnrollment {
  userId: string
  /** Base32-encoded shared secret (see crypto/base32). */
  secret: string
  status: EnrollmentStatus
  createdAt: Date
  confirmedAt: Date | null
  revokedAt: Date | null
}

/** Hashed backup code row; plaintext is only returned once from confirm(). */
export interface RecoveryCode {
  userId: string
  codeHash: string
  usedAt: Date | null
}

export interface StorageAdapter {
  /** Upsert: overwrites any existing enrollment for the same userId. */
  saveEnrollment(enrollment: TOTPEnrollment): Promise<void>
  /** Returns null when no record exists (does not throw). */
  getEnrollment(userId: string): Promise<TOTPEnrollment | null>
  updateEnrollment(
    userId: string,
    patch: Partial<TOTPEnrollment>,
  ): Promise<void>
  deleteEnrollment(userId: string): Promise<void>

  /** Replaces all recovery codes for the user (batch from one confirm/regenerate). */
  saveRecoveryCodes(codes: RecoveryCode[]): Promise<void>
  /** Returns [] when none exist. */
  getRecoveryCodes(userId: string): Promise<RecoveryCode[]>
  markRecoveryCodeUsed(userId: string, codeHash: string): Promise<void>
  deleteRecoveryCodes(userId: string): Promise<void>
}
