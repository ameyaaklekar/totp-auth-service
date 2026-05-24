/**
 * RFC 4648 Base32 encode/decode for TOTP shared secrets.
 *
 * Authenticator apps and otpauth:// URIs store secrets as Base32 text (A–Z, 2–7),
 * not raw bytes. generateSecret() encodes random bytes; verifyCode() decodes
 * before HMAC. No padding is required for typical OTP secret lengths.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Pack raw bytes into a Base32 string (5 bits per alphabet character). */
export function encodeBase32(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  // Emit final partial quintet if the byte stream did not align on 5-bit boundaries.
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

/** Unpack a Base32 secret string into the raw key bytes used by HMAC. */
export function decodeBase32(encoded: string): Buffer {
  const normalized = encoded.replace(/=+$/, '').toUpperCase()
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of normalized) {
    const index = ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`)
    }

    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}
