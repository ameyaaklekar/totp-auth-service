/**
 * In-memory StorageAdapter for tests and consumer test suites.
 * Not for production — no persistence, no cross-process sharing.
 *
 * Clones Date instances on read/write so callers cannot mutate internal state.
 */
import type {
  RecoveryCode,
  StorageAdapter,
  TOTPEnrollment,
} from '../adapters/storage.js'

function cloneEnrollment(enrollment: TOTPEnrollment): TOTPEnrollment {
  return {
    ...enrollment,
    createdAt: new Date(enrollment.createdAt),
    confirmedAt: enrollment.confirmedAt
      ? new Date(enrollment.confirmedAt)
      : null,
    revokedAt: enrollment.revokedAt ? new Date(enrollment.revokedAt) : null,
  }
}

function cloneRecoveryCode(code: RecoveryCode): RecoveryCode {
  return {
    ...code,
    usedAt: code.usedAt ? new Date(code.usedAt) : null,
  }
}

export class MemoryAdapter implements StorageAdapter {
  private readonly enrollments = new Map<string, TOTPEnrollment>()
  private readonly recoveryCodes = new Map<string, RecoveryCode[]>()

  async saveEnrollment(enrollment: TOTPEnrollment): Promise<void> {
    this.enrollments.set(enrollment.userId, cloneEnrollment(enrollment))
  }

  async getEnrollment(userId: string): Promise<TOTPEnrollment | null> {
    const enrollment = this.enrollments.get(userId)
    return enrollment ? cloneEnrollment(enrollment) : null
  }

  async updateEnrollment(
    userId: string,
    patch: Partial<TOTPEnrollment>,
  ): Promise<void> {
    const existing = this.enrollments.get(userId)
    if (!existing) return
    this.enrollments.set(userId, cloneEnrollment({ ...existing, ...patch }))
  }

  async deleteEnrollment(userId: string): Promise<void> {
    this.enrollments.delete(userId)
  }

  async saveRecoveryCodes(codes: RecoveryCode[]): Promise<void> {
    if (codes.length === 0) return
    const userId = codes[0]!.userId
    this.recoveryCodes.set(
      userId,
      codes.map((c) => cloneRecoveryCode(c)),
    )
  }

  async getRecoveryCodes(userId: string): Promise<RecoveryCode[]> {
    const codes = this.recoveryCodes.get(userId) ?? []
    return codes.map(cloneRecoveryCode)
  }

  async markRecoveryCodeUsed(
    userId: string,
    codeHash: string,
  ): Promise<void> {
    const codes = this.recoveryCodes.get(userId)
    if (!codes) return

    this.recoveryCodes.set(
      userId,
      codes.map((c) =>
        c.codeHash === codeHash
          ? { ...c, usedAt: new Date() }
          : cloneRecoveryCode(c),
      ),
    )
  }

  async deleteRecoveryCodes(userId: string): Promise<void> {
    this.recoveryCodes.delete(userId)
  }

  /** Clear all stored data — for test isolation between cases. */
  reset(): void {
    this.enrollments.clear()
    this.recoveryCodes.clear()
  }
}
