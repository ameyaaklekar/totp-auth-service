/** Programmatic `error.code` values on TOTPError subclasses. */
export enum TOTPErrorCode {
  EnrollmentNotFound = 'ENROLLMENT_NOT_FOUND',
  EnrollmentConflict = 'ENROLLMENT_CONFLICT',
  EnrollmentNotActive = 'ENROLLMENT_NOT_ACTIVE',
  EnrollmentPending = 'ENROLLMENT_PENDING',
  InvalidCode = 'INVALID_CODE',
}
