import {decodeAlaw} from './alawDecoder'

// Default sample rate assumed for raw .alw files (no header)
const ALW_SAMPLE_RATE = 8000

// ─── WAV parser ───────────────────────────────────────────────────────────────
//
// Walks RIFF/WAVE chunks to find 'fmt ' and 'data', then decodes according to
// audioFormat:  1 = PCM,  3 = IEEE float,  6 = A-law,  7 = µ-law.
//
/**
 * Parse a WAV ArrayBuffer.
 * Returns { pcm: Int16Array, sampleRate, numChannels } or throws.
 */
export function parseWav(arrayBuffer) {
  const view = new DataView(arrayBuffer)

  if (view.getUint32(0, false) !== 0x52494646) throw new Error('Not a RIFF file')
  if (view.getUint32(8, false) !== 0x57415645) throw new Error('Not a WAVE file')

  let fmt = null
  let dataOffset = 0
  let dataLength = 0
  let offset = 12

  while (offset + 8 <= view.byteLength) {
    const chunkId = view.getUint32(offset, false) // big-endian ASCII
    const chunkSize = view.getUint32(offset + 4, true)

    if (chunkId === 0x666d7420 /* 'fmt ' */) {
      fmt = {
        audioFormat: view.getUint16(offset + 8, true),
        numChannels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        bitsPerSample: view.getUint16(offset + 22, true),
      }
    } else if (chunkId === 0x64617461 /* 'data' */) {
      dataOffset = offset + 8
      dataLength = chunkSize
    }

    offset += 8 + chunkSize + (chunkSize & 1) // chunks are padded to even size
  }

  if (!fmt) throw new Error('No fmt chunk found in WAV file')
  if (!dataOffset) throw new Error('No data chunk found in WAV file')

  const raw = new Uint8Array(arrayBuffer, dataOffset, dataLength)

  switch (fmt.audioFormat) {
    case 1: // PCM
      if (fmt.bitsPerSample === 16) {
        return {
          pcm: new Int16Array(arrayBuffer, dataOffset, dataLength / 2),
          sampleRate: fmt.sampleRate,
          numChannels: fmt.numChannels,
        }
      }
      if (fmt.bitsPerSample === 8) {
        // 8-bit PCM is unsigned; shift to signed 16-bit
        const pcm8 = new Int16Array(raw.length)
        for (let i = 0; i < raw.length; i++) pcm8[i] = (raw[i] - 128) << 8
        return {pcm: pcm8, sampleRate: fmt.sampleRate, numChannels: fmt.numChannels}
      }
      throw new Error(`Unsupported PCM bit depth: ${fmt.bitsPerSample}`)

    case 3: { // IEEE float 32-bit
      const f32 = new Float32Array(arrayBuffer, dataOffset, dataLength / 4)
      const pcmF = new Int16Array(f32.length)
      for (let i = 0; i < f32.length; i++) {
        const s = Math.max(-1, Math.min(1, f32[i]))
        pcmF[i] = Math.round(s * (s < 0 ? 32768 : 32767))
      }
      return {pcm: pcmF, sampleRate: fmt.sampleRate, numChannels: fmt.numChannels}
    }

    case 6: // A-law
      return {
        pcm: decodeAlaw(raw),
        sampleRate: fmt.sampleRate,
        numChannels: fmt.numChannels,
      }

    case 7: { // µ-law
      return {
        pcm: decodeMulaw(raw),
        sampleRate: fmt.sampleRate,
        numChannels: fmt.numChannels,
      }
    }

    default:
      throw new Error(`Unsupported WAV audio format: ${fmt.audioFormat}`)
  }
}

// ─── Raw A-law file (.alw) ────────────────────────────────────────────────────

/**
 * Parse a raw A-law file (no WAV header): 8-bit bytes, mono, ALW_SAMPLE_RATE Hz.
 */
export function parseAlw(arrayBuffer) {
  return {
    pcm: decodeAlaw(new Uint8Array(arrayBuffer)),
    sampleRate: ALW_SAMPLE_RATE,
    numChannels: 1,
  }
}

// ─── µ-law decoder (G.711) ───────────────────────────────────────────────────

function decodeMulaw(bytes) {
  const table = new Int16Array(256)
  for (let i = 0; i < 256; i++) {
    let v = (~i) & 0xff
    const sign = v & 0x80
    let t = ((v & 0x0f) << 3) + 0x84
    t <<= (v & 0x70) >> 4
    table[i] = sign ? 0x84 - t : t - 0x84
  }
  const pcm = new Int16Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) pcm[i] = table[bytes[i]]
  return pcm
}

// ─── PCM → AudioBuffer ────────────────────────────────────────────────────────

/**
 * Convert interleaved Int16 PCM to an AudioBuffer, resampling to targetSampleRate.
 * Uses OfflineAudioContext for high-quality resampling when rates differ.
 */
export async function pcmToAudioBuffer(pcm, sampleRate, numChannels, targetSampleRate) {
  const samplesPerChannel = Math.floor(pcm.length / numChannels)

  const srcBuf = new AudioBuffer({numberOfChannels: numChannels, length: samplesPerChannel, sampleRate})
  for (let ch = 0; ch < numChannels; ch++) {
    const data = srcBuf.getChannelData(ch)
    for (let i = 0; i < samplesPerChannel; i++) {
      data[i] = pcm[i * numChannels + ch] / 32768
    }
  }

  if (sampleRate === targetSampleRate) return srcBuf

  const outLen = Math.ceil(samplesPerChannel / sampleRate * targetSampleRate)
  const offCtx = new OfflineAudioContext(numChannels, outLen, targetSampleRate)
  const src = offCtx.createBufferSource()
  src.buffer = srcBuf
  src.connect(offCtx.destination)
  src.start(0)
  return offCtx.startRendering()
}

// ─── WAV encoder ─────────────────────────────────────────────────────────────
//
// Writes a standard RIFF/WAVE file with a 44-byte header and 16-bit PCM data.
// Header layout:
//   0–3   'RIFF'
//   4–7   file size − 8
//   8–11  'WAVE'
//   12–15 'fmt '
//   16–19 fmt chunk size (16)
//   20–21 audio format (1 = PCM)
//   22–23 channels
//   24–27 sample rate
//   28–31 byte rate  (sampleRate × channels × 2)
//   32–33 block align (channels × 2)
//   34–35 bits per sample (16)
//   36–39 'data'
//   40–43 data chunk size
//   44…   interleaved signed 16-bit samples (little-endian)
//
/**
 * Encode an AudioBuffer to a 16-bit PCM WAV Blob.
 */
export function encodeWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const numSamples = audioBuffer.length

  const interleaved = new Int16Array(numSamples * numChannels)
  for (let ch = 0; ch < numChannels; ch++) {
    const data = audioBuffer.getChannelData(ch)
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, data[i]))
      interleaved[i * numChannels + ch] = Math.round(s * (s < 0 ? 32768 : 32767))
    }
  }

  const dataBytes = interleaved.byteLength
  const buf = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buf)

  w4cc(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  w4cc(view, 8, 'WAVE')
  w4cc(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  w4cc(view, 36, 'data')
  view.setUint32(40, dataBytes, true)
  new Int16Array(buf, 44).set(interleaved)

  return new Blob([buf], {type: 'audio/wav'})
}

function w4cc(view, offset, str) {
  for (let i = 0; i < 4; i++) view.setUint8(offset + i, str.charCodeAt(i))
}
