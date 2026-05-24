/** Main package entry (`totp-auth`) — service, storage types, errors, and enums. */
export { TOTPService } from './service/TOTPService.js'
export type {
  ConfirmResult,
  EnrollmentResult,
  EnrollmentStatusView,
  TOTPServiceConfig,
  VerifyResult,
} from './service/types.js'
export type {
  RecoveryCode,
  StorageAdapter,
  TOTPEnrollment,
} from './adapters/storage.js'
export {
  EnrollmentConflictError,
  EnrollmentNotActiveError,
  EnrollmentNotFoundError,
  EnrollmentPendingError,
  InvalidCodeError,
  TOTPError,
} from './errors.js'
export {
  EnrollmentStatus,
  TotpAlgorithm,
  TOTPErrorCode,
} from './enums/index.js'
