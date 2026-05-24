import { TOTPErrorCode } from './enums/error-code.js'

/**
 * Typed errors for enrollment state violations and invalid codes.
 * Catch by subclass or by `error.code` (TOTPErrorCode).
 */

export class TOTPError extends Error {
  readonly code: TOTPErrorCode

  constructor(message: string, code: TOTPErrorCode) {
    super(message)
    this.name = new.target.name
    this.code = code
  }
}

/** No enrollment row, or revoke() called when status is already revoked. */
export class EnrollmentNotFoundError extends TOTPError {
  constructor(message = 'Enrollment not found') {
    super(message, TOTPErrorCode.EnrollmentNotFound)
  }
}

/** enroll() while status is pending or active. */
export class EnrollmentConflictError extends TOTPError {
  constructor(message = 'Enrollment already exists') {
    super(message, TOTPErrorCode.EnrollmentConflict)
  }
}

/** verify() or regenerateRecoveryCodes() when not active (includes revoked). */
export class EnrollmentNotActiveError extends TOTPError {
  constructor(message = 'Enrollment is not active') {
    super(message, TOTPErrorCode.EnrollmentNotActive)
  }
}

/** verify() before confirm() completes (status still pending). */
export class EnrollmentPendingError extends TOTPError {
  constructor(message = 'Enrollment is pending confirmation') {
    super(message, TOTPErrorCode.EnrollmentPending)
  }
}

/** confirm() when the submitted TOTP does not match. */
export class InvalidCodeError extends TOTPError {
  constructor(message = 'Invalid code') {
    super(message, TOTPErrorCode.InvalidCode)
  }
}
