import { describe, expect, it } from 'vitest'
import {
  buildOtpAuthUri,
  generateCode,
  generateSecret,
  verifyCode,
} from '../src/crypto/index.js'

describe('generateSecret', () => {
  it('returns base32-encoded secrets', () => {
    const secret = generateSecret()
    expect(secret).toMatch(/^[A-Z2-7]+$/)
    expect(secret.length).toBeGreaterThanOrEqual(32)
  })

  it('rejects short byte lengths', () => {
    expect(() => generateSecret({ length: 8 })).toThrow()
  })
})

describe('buildOtpAuthUri', () => {
  it('builds a valid otpauth URI', () => {
    const uri = buildOtpAuthUri({
      secret: 'JBSWY3DPEHPK3PXP',
      accountName: 'user@example.com',
      issuer: 'MyApp',
    })
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('issuer=MyApp')
  })
})

describe('generateCode / verifyCode', () => {
  const secret = 'JBSWY3DPEHPK3PXP'
  const timestamp = 1_590_000_000_000

  it('generates and verifies codes with injectable timestamp', () => {
    const code = generateCode(secret, { timestamp })
    expect(code).toMatch(/^\d{6}$/)
    expect(
      verifyCode(secret, code, { timestamp, window: 0 }),
    ).toBe(true)
  })

  it('accepts codes within the drift window', () => {
    const code = generateCode(secret, {
      timestamp: timestamp - 30_000,
    })
    expect(
      verifyCode(secret, code, { timestamp, window: 1 }),
    ).toBe(true)
  })

  it('rejects codes outside the drift window', () => {
    const code = generateCode(secret, {
      timestamp: timestamp - 90_000,
    })
    expect(
      verifyCode(secret, code, { timestamp, window: 1 }),
    ).toBe(false)
  })

  it('supports 8-digit codes', () => {
    const code = generateCode(secret, { timestamp, digits: 8 })
    expect(code).toHaveLength(8)
    expect(
      verifyCode(secret, code, { timestamp, digits: 8, window: 0 }),
    ).toBe(true)
  })
})
