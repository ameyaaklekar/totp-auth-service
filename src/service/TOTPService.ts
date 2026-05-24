/**
 * TOTP MFA orchestration: enrollment state machine, verification, recovery codes.
 *
 * State flow: [none|revoked] --enroll--> pending --confirm--> active --revoke--> revoked
 * Does not issue sessions or JWTs — only the MFA step in a larger auth flow.
 */
import type { StorageAdapter, TOTPEnrollment } from '../adapters/storage.js'
import { buildOtpAuthUri } from '../crypto/uri.js'
import { generateSecret } from '../crypto/secret.js'
import { verifyCode } from '../crypto/verify.js'
import { EnrollmentStatus } from '../enums/enrollment-status.js'
import { TotpAlgorithm } from '../enums/totp-algorithm.js'
import {
  EnrollmentConflictError,
  EnrollmentNotActiveError,
  EnrollmentNotFoundError,
  EnrollmentPendingError,
  InvalidCodeError,
} from '../errors.js'
import {
  findMatchingRecoveryCode,
  generateRecoveryCodes,
} from './recovery.js'
import type {
  ConfirmResult,
  EnrollmentResult,
  EnrollmentStatusView,
  TOTPServiceConfig,
  VerifyResult,
} from './types.js'

export class TOTPService {
  private readonly storage: StorageAdapter
  private readonly issuer: string
  private readonly digits: 6 | 8
  private readonly period: number
  private readonly algorithm: TotpAlgorithm
  private readonly window: number
  private readonly recoveryCodeCount: number

  constructor(config: TOTPServiceConfig) {
    this.storage = config.storage
    this.issuer = config.issuer
    this.digits = config.digits ?? 6
    this.period = config.period ?? 30
    this.algorithm = config.algorithm ?? TotpAlgorithm.SHA1
    this.window = config.window ?? 1
    this.recoveryCodeCount = config.recoveryCodeCount ?? 10
  }

  /**
   * Start enrollment: new secret, status pending.
   * Allowed when no record exists or previous enrollment was revoked.
   */
  async enroll(userId: string): Promise<EnrollmentResult> {
    const existing = await this.storage.getEnrollment(userId)

    if (
      existing?.status === EnrollmentStatus.Pending ||
      existing?.status === EnrollmentStatus.Active
    ) {
      throw new EnrollmentConflictError()
    }

    // Stale backup codes from a prior active enrollment must not survive re-enroll.
    if (existing?.status === EnrollmentStatus.Revoked) {
      await this.storage.deleteRecoveryCodes(userId)
    }

    const secret = generateSecret()
    const now = new Date()
    const enrollment: TOTPEnrollment = {
      userId,
      secret,
      status: EnrollmentStatus.Pending,
      createdAt: now,
      confirmedAt: null,
      revokedAt: null,
    }

    await this.storage.saveEnrollment(enrollment)

    const otpAuthUri = buildOtpAuthUri({
      secret,
      accountName: userId,
      issuer: this.issuer,
      digits: this.digits,
      period: this.period,
      algorithm: this.algorithm,
    })

    return { secret, otpAuthUri }
  }

  /**
   * Prove the authenticator is configured: first valid TOTP → active.
   * Issues recovery codes (plaintext returned once).
   */
  async confirm(userId: string, code: string): Promise<ConfirmResult> {
    const enrollment = await this.requireEnrollment(userId)

    if (enrollment.status !== EnrollmentStatus.Pending) {
      if (enrollment.status === EnrollmentStatus.Active) {
        throw new EnrollmentConflictError('Enrollment is already active')
      }
      throw new EnrollmentNotActiveError()
    }

    if (
      !verifyCode(enrollment.secret, code, {
        window: this.window,
        period: this.period,
        digits: this.digits,
        algorithm: this.algorithm,
      })
    ) {
      throw new InvalidCodeError()
    }

    const now = new Date()
    await this.storage.updateEnrollment(userId, {
      status: EnrollmentStatus.Active,
      confirmedAt: now,
    })

    await this.storage.deleteRecoveryCodes(userId)
    const { plaintext, stored } = generateRecoveryCodes(
      userId,
      this.recoveryCodeCount,
    )
    await this.storage.saveRecoveryCodes(stored)

    return { recoveryCodes: plaintext }
  }

  /**
   * Login MFA step: try TOTP first, then single-use recovery codes.
   * Invalid TOTP returns { valid: false } rather than throwing.
   */
  async verify(userId: string, code: string): Promise<VerifyResult> {
    const enrollment = await this.requireEnrollment(userId)

    if (enrollment.status === EnrollmentStatus.Pending) {
      throw new EnrollmentPendingError()
    }

    if (enrollment.status === EnrollmentStatus.Revoked) {
      throw new EnrollmentNotActiveError()
    }

    const totpValid = verifyCode(enrollment.secret, code, {
      window: this.window,
      period: this.period,
      digits: this.digits,
      algorithm: this.algorithm,
    })

    if (totpValid) {
      return { valid: true, usedRecoveryCode: false }
    }

    const recoveryCodes = await this.storage.getRecoveryCodes(userId)
    const match = findMatchingRecoveryCode(recoveryCodes, code)

    if (!match) {
      return { valid: false, usedRecoveryCode: false }
    }

    await this.storage.markRecoveryCodeUsed(userId, match.codeHash)
    return { valid: true, usedRecoveryCode: true }
  }

  /** Disable MFA; removes all recovery codes. Allowed from pending or active. */
  async revoke(userId: string): Promise<void> {
    const enrollment = await this.requireEnrollment(userId)

    if (
      enrollment.status !== EnrollmentStatus.Pending &&
      enrollment.status !== EnrollmentStatus.Active
    ) {
      throw new EnrollmentNotFoundError()
    }

    await this.storage.updateEnrollment(userId, {
      status: EnrollmentStatus.Revoked,
      revokedAt: new Date(),
    })
    await this.storage.deleteRecoveryCodes(userId)
  }

  /** Status snapshot without the shared secret. */
  async getStatus(userId: string): Promise<EnrollmentStatusView | null> {
    const enrollment = await this.storage.getEnrollment(userId)
    if (!enrollment) return null

    return {
      userId: enrollment.userId,
      status: enrollment.status,
      createdAt: enrollment.createdAt,
      confirmedAt: enrollment.confirmedAt,
      revokedAt: enrollment.revokedAt,
    }
  }

  /** GDPR / account deletion — never throws, safe if user has no data. */
  async delete(userId: string): Promise<void> {
    await this.storage.deleteEnrollment(userId)
    await this.storage.deleteRecoveryCodes(userId)
  }

  /** Replace all backup codes; previous codes are invalidated immediately. */
  async regenerateRecoveryCodes(
    userId: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const enrollment = await this.requireEnrollment(userId)

    if (enrollment.status !== EnrollmentStatus.Active) {
      throw new EnrollmentNotActiveError()
    }

    await this.storage.deleteRecoveryCodes(userId)
    const { plaintext, stored } = generateRecoveryCodes(
      userId,
      this.recoveryCodeCount,
    )
    await this.storage.saveRecoveryCodes(stored)

    return { recoveryCodes: plaintext }
  }

  private async requireEnrollment(userId: string): Promise<TOTPEnrollment> {
    const enrollment = await this.storage.getEnrollment(userId)
    if (!enrollment) {
      throw new EnrollmentNotFoundError()
    }
    return enrollment
  }
}
