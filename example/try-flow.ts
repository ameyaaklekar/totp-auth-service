/**
 * Manual demo: enroll, print QR for authenticator apps, then run confirm/verify
 * with generateCode() (simulated app). Scan the QR to test with a real phone instead.
 *
 * Run: npm run demo
 */
import { writeFile } from 'fs/promises'
import QRCode from 'qrcode'
import { TOTPService } from '../src/index.js'
import { generateCode, TotpAlgorithm } from '../src/crypto/index.js'
import type { TotpOptions } from '../src/crypto/index.js'
import { MemoryAdapter } from '../src/testing/MemoryAdapter.js'

const QR_PNG_PATH = 'totp-qr.png'

/** Must match TOTPService — generateCode defaults to SHA1 if omitted. */
const totpConfig = {
  issuer: 'MyApp',
  algorithm: TotpAlgorithm.SHA512,
  digits: 6 as const,
  period: 30,
  window: 1,
}

const cryptoOptions: TotpOptions = {
  algorithm: totpConfig.algorithm,
  digits: totpConfig.digits,
  period: totpConfig.period,
}

const totp = new TOTPService({
  storage: new MemoryAdapter(),
  ...totpConfig,
})
const userId = 'demo-user'

const { secret, otpAuthUri } = await totp.enroll(userId)

console.log('\n--- otpauth URI (manual entry) ---\n')
console.log(otpAuthUri)

console.log('\n--- Scan with your authenticator (terminal QR) ---\n')
console.log(
  await QRCode.toString(otpAuthUri, { type: 'terminal', small: true }),
)

const png = await QRCode.toBuffer(otpAuthUri, {
  type: 'png',
  width: 128,
  margin: 2,
})
await writeFile(QR_PNG_PATH, png)
console.log(`\nPNG saved: ${QR_PNG_PATH} (open and scan if terminal QR is hard to read)\n`)

const code = generateCode(secret, cryptoOptions)
console.log('Simulated app code (for confirm below):', code)

const { recoveryCodes } = await totp.confirm(userId, code)
console.log('\nRecovery codes (show once):', recoveryCodes)

const login = await totp.verify(userId, generateCode(secret, cryptoOptions))
console.log('\nVerify result:', login)
