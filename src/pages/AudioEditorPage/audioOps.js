export const TARGET_SAMPLE_RATE = 44100

/**
 * Resample buffer to TARGET_SAMPLE_RATE and upmix/downmix to numChannels.
 * Uses OfflineAudioContext so the browser's high-quality resampler does the work.
 * Returns the same buffer unchanged if it's already at the right rate and channel count.
 */
export async function normalizeBuffer(buffer, numChannels) {
  if (buffer.sampleRate === TARGET_SAMPLE_RATE && buffer.numberOfChannels === numChannels) {
    return buffer
  }
  const length = Math.ceil(buffer.duration * TARGET_SAMPLE_RATE)
  const offCtx = new OfflineAudioContext(numChannels, length, TARGET_SAMPLE_RATE)
  const src = offCtx.createBufferSource()
  src.buffer = buffer
  src.connect(offCtx.destination)
  src.start(0)
  return offCtx.startRendering()
}

/**
 * Concatenate two AudioBuffers (same sample rate, same channel count).
 */
export function concatBuffers(a, b) {
  const numChannels = a.numberOfChannels
  const length = a.length + b.length
  const out = new AudioBuffer({numberOfChannels: numChannels, length, sampleRate: TARGET_SAMPLE_RATE})
  for (let ch = 0; ch < numChannels; ch++) {
    const dst = out.getChannelData(ch)
    dst.set(a.getChannelData(ch), 0)
    dst.set(b.getChannelData(ch), a.length)
  }
  return out
}

/**
 * Remove samples [startSample, endSample) and join the two remaining parts.
 * Returns null if the result would be empty.
 */
export function cutBuffer(buffer, startSample, endSample) {
  const numChannels = buffer.numberOfChannels
  const newLength = buffer.length - (endSample - startSample)
  if (newLength <= 0) return null
  const out = new AudioBuffer({numberOfChannels: numChannels, length: newLength, sampleRate: TARGET_SAMPLE_RATE})
  for (let ch = 0; ch < numChannels; ch++) {
    const src = buffer.getChannelData(ch)
    const dst = out.getChannelData(ch)
    dst.set(src.subarray(0, startSample), 0)
    dst.set(src.subarray(endSample), startSample)
  }
  return out
}

/**
 * Insert durationSamples of silence at positionSample.
 * The silent region is zero-filled (Float32Array default).
 */
export function insertSilence(buffer, positionSample, durationSamples) {
  const numChannels = buffer.numberOfChannels
  const newLength = buffer.length + durationSamples
  const out = new AudioBuffer({numberOfChannels: numChannels, length: newLength, sampleRate: TARGET_SAMPLE_RATE})
  for (let ch = 0; ch < numChannels; ch++) {
    const src = buffer.getChannelData(ch)
    const dst = out.getChannelData(ch)
    dst.set(src.subarray(0, positionSample), 0)
    // silence occupies [positionSample, positionSample + durationSamples) — already zeroed
    dst.set(src.subarray(positionSample), positionSample + durationSamples)
  }
  return out
}
