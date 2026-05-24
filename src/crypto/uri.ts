import { TotpAlgorithm } from '../enums/totp-algorithm.js'

export interface BuildOtpAuthUriOptions {
  secret: string
  accountName: string
  issuer: string
  digits?: number
  period?: number
  algorithm?: TotpAlgorithm
}

/**
 * Build an otpauth://totp/ URI for QR codes and manual entry in authenticator apps.
 * Label format follows the de-facto `Issuer:account` convention (both URL-encoded).
 */
export function buildOtpAuthUri(options: BuildOtpAuthUriOptions): string {
  const digits = options.digits ?? 6
  const period = options.period ?? 30
  const algorithm = options.algorithm ?? TotpAlgorithm.SHA1

  const label = encodeURIComponent(`${options.issuer}:${options.accountName}`)
  const params = new URLSearchParams({
    secret: options.secret,
    issuer: options.issuer,
    algorithm,
    digits: String(digits),
    period: String(period),
  })

  return `otpauth://totp/${label}?${params.toString()}`
}
