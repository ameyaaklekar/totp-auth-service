import { describe, expect, it, beforeEach } from 'vitest'
import { generateCode } from '../src/crypto/index.js'
import { EnrollmentStatus } from '../src/enums/enrollment-status.js'
import { TOTPErrorCode } from '../src/enums/error-code.js'
import {
  EnrollmentConflictError,
  EnrollmentNotActiveError,
  EnrollmentNotFoundError,
  EnrollmentPendingError,
} from '../src/errors.js'
import { TOTPService } from '../src/service/TOTPService.js'
import { MemoryAdapter } from '../src/testing/MemoryAdapter.js'

describe('TOTPService', () => {
  let storage: MemoryAdapter
  let totp: TOTPService

  beforeEach(() => {
    storage = new MemoryAdapter()
    totp = new TOTPService({
      storage,
      issuer: 'TestApp',
      recoveryCodeCount: 3,
    })
  })

  it('enrolls a new user as pending', async () => {
    const result = await totp.enroll('user-1')
    expect(result.secret).toBeTruthy()
    expect(result.otpAuthUri).toContain('otpauth://totp/')

    const status = await totp.getStatus('user-1')
    expect(status?.status).toBe(EnrollmentStatus.Pending)
  })

  it('rejects enroll when pending or active', async () => {
    await totp.enroll('user-1')
    await expect(totp.enroll('user-1')).rejects.toBeInstanceOf(
      EnrollmentConflictError,
    )

    const enrollment = await storage.getEnrollment('user-1')
    const code = generateCode(enrollment!.secret)
    await totp.confirm('user-1', code)

    await expect(totp.enroll('user-1')).rejects.toBeInstanceOf(
      EnrollmentConflictError,
    )
  })

  it('confirms enrollment and returns recovery codes once', async () => {
    const { secret } = await totp.enroll('user-1')
    const code = generateCode(secret)
    const { recoveryCodes } = await totp.confirm('user-1', code)

    expect(recoveryCodes).toHaveLength(3)
    const status = await totp.getStatus('user-1')
    expect(status?.status).toBe(EnrollmentStatus.Active)
    expect(status?.confirmedAt).toBeInstanceOf(Date)
  })

  it('throws InvalidCodeError on bad confirm code', async () => {
    await totp.enroll('user-1')
    await expect(totp.confirm('user-1', '000000')).rejects.toMatchObject({
      code: TOTPErrorCode.InvalidCode,
    })
  })

  it('verifies TOTP codes for active enrollments', async () => {
    const { secret } = await totp.enroll('user-1')
    await totp.confirm('user-1', generateCode(secret))

    const result = await totp.verify('user-1', generateCode(secret))
    expect(result).toEqual({ valid: true, usedRecoveryCode: false })
  })

  it('verifies and consumes recovery codes', async () => {
    const { secret } = await totp.enroll('user-1')
    const { recoveryCodes } = await totp.confirm(
      'user-1',
      generateCode(secret),
    )
    const backup = recoveryCodes[0]!

    const first = await totp.verify('user-1', backup)
    expect(first).toEqual({ valid: true, usedRecoveryCode: true })

    const second = await totp.verify('user-1', backup)
    expect(second).toEqual({ valid: false, usedRecoveryCode: false })
  })

  it('throws EnrollmentPendingError when verifying pending', async () => {
    await totp.enroll('user-1')
    await expect(totp.verify('user-1', '123456')).rejects.toBeInstanceOf(
      EnrollmentPendingError,
    )
  })

  it('revokes and deletes recovery codes', async () => {
    const { secret } = await totp.enroll('user-1')
    const { recoveryCodes } = await totp.confirm(
      'user-1',
      generateCode(secret),
    )

    await totp.revoke('user-1')
    const status = await totp.getStatus('user-1')
    expect(status?.status).toBe(EnrollmentStatus.Revoked)

    const codes = await storage.getRecoveryCodes('user-1')
    expect(codes).toHaveLength(0)

    await expect(
      totp.verify('user-1', recoveryCodes[0]!),
    ).rejects.toBeInstanceOf(EnrollmentNotActiveError)
  })

  it('allows re-enrollment after revoke', async () => {
    const { secret } = await totp.enroll('user-1')
    await totp.confirm('user-1', generateCode(secret))
    await totp.revoke('user-1')

    const second = await totp.enroll('user-1')
    expect(second.secret).not.toBe(secret)

    const status = await totp.getStatus('user-1')
    expect(status?.status).toBe(EnrollmentStatus.Pending)
  })

  it('delete is safe on missing users', async () => {
    await expect(totp.delete('missing')).resolves.toBeUndefined()
  })

  it('regenerates recovery codes for active users', async () => {
    const { secret } = await totp.enroll('user-1')
    const first = await totp.confirm('user-1', generateCode(secret))
    const second = await totp.regenerateRecoveryCodes('user-1')

    expect(second.recoveryCodes).toHaveLength(3)
    expect(second.recoveryCodes).not.toEqual(first.recoveryCodes)

    const oldUse = await totp.verify('user-1', first.recoveryCodes[0]!)
    expect(oldUse.valid).toBe(false)
  })

  it('throws EnrollmentNotFoundError for missing user operations', async () => {
    await expect(totp.confirm('x', '123456')).rejects.toBeInstanceOf(
      EnrollmentNotFoundError,
    )
    await expect(totp.revoke('x')).rejects.toBeInstanceOf(
      EnrollmentNotFoundError,
    )
  })

  it('getStatus returns null without secret', async () => {
    expect(await totp.getStatus('none')).toBeNull()
    await totp.enroll('user-1')
    const status = await totp.getStatus('user-1')
    expect(status).not.toHaveProperty('secret')
  })
})
