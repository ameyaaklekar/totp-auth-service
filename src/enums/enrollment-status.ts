/** Lifecycle states for a user's TOTP enrollment record. */
export enum EnrollmentStatus {
  Pending = 'pending',
  Active = 'active',
  Revoked = 'revoked',
}
