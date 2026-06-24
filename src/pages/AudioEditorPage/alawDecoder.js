// Standard G.711 A-law expansion.
// Each compressed 8-bit byte maps to a signed 16-bit linear PCM sample.
//
// Algorithm (ITU-T G.711):
//   1. XOR byte with 0x55 to invert alternate bits (line coding).
//   2. Extract sign (bit 7), segment (bits 6–4), and mantissa (bits 3–0).
//   3. Expand mantissa + segment into a 13-bit magnitude, then apply sign.
function alawByteToLinear(byte) {
  byte ^= 0x55 // invert alternate bits
  const sign = byte & 0x80
  let t = (byte & 0x0f) << 4
  const seg = (byte & 0x70) >> 4
  if (seg === 0) {
    t += 8
  } else if (seg === 1) {
    t += 0x108
  } else {
    t <<= seg - 1
    t += 0x108 << (seg - 1)
  }
  // sign bit set → positive original signal
  return sign ? t : -t
}

// Pre-built lookup for fast batch decode
const ALAW_TABLE = new Int16Array(256)
for (let i = 0; i < 256; i++) ALAW_TABLE[i] = alawByteToLinear(i)

/**
 * Decode a Uint8Array of raw A-law bytes to signed 16-bit PCM samples.
 */
export function decodeAlaw(bytes) {
  const pcm = new Int16Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) pcm[i] = ALAW_TABLE[bytes[i]]
  return pcm
}
