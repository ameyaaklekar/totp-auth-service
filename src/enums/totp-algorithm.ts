/** HMAC algorithm for TOTP (otpauth `algorithm` param and HMAC digest). */
export enum TotpAlgorithm {
  SHA1 = 'SHA1',
  SHA256 = 'SHA256',
  SHA512 = 'SHA512',
}
