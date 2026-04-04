import {pluralUA} from '@/lib/utils'

const noLetterAhead = String.raw`(?![\p{L}])`

/**
 * Normalizes text to be use in 11labs TTS
 * @param {string} text
 * @returns {string}
 */
export default function normalizeForTTS(input, opts = {}) {
  const options = {normalizeGigabytes: true, normalizeSms: true, ...opts}
  let text = String(input ?? '')

  // Unicode + whitespace normalization
  text = text.normalize('NFC')
  // text = text.replace(/\s+/g, ' ').trim();

  // 1) "грн/міс" → "гривень на місяць" (supports spaces, Latin 'i')
  text = text.replace(
    /(?<!\p{L})(?:грн\.?\s*\/\s*м[іi]с)(?!\p{L})/giu,
    'гривень на місяць',
  )

  // 3) Standalone "400 грн" → pluralized form
  const hrnStandalone = new RegExp(
    String.raw`(\d+)\s*грн\.?${noLetterAhead}`,
    'giu',
  )
  text = text.replace(
    hrnStandalone,
    (_, n) => `${n} ${pluralUA(n, 'гривня', 'гривні', 'гривень')}`,
  )

  // 4) Gigabytes
  if (options.normalizeGigabytes) {
    // Matches: 1 ГБ, 2 гб, 3 GB, 4 gb, with optional trailing dot, and no letter after
    const gbRegex = new RegExp(
      String.raw`(\d+)\s*(?:ГБ|GB)\.?${noLetterAhead}`,
      'giu',
    )
    text = text.replace(
      gbRegex,
      (_, n) => `${n} ${pluralUA(n, 'гігабайт', 'гігабайти', 'гігабайтів')}`,
    )
  }

  // 5) SMS
  if (options.normalizeSms) {
    text = text.replace(/(?<!\p{L})(?:SMS|СМС)(?!\p{L})/giu, 'есемес')
  }

  // 6) Dashes: replace spaced hyphen with em dash (keep URLs intact by requiring spaces)
  text = text.replace(/(?<=\s)-(?=\s)/g, '—')

  // 7) Quotes: straight quotes → «…»
  // text = text.replace(/"([^"]+)"/g, '«$1»').replace(/''([^']+)''/g, '«$1»');

  // 8) Minutes: replace "100 хв" → pluralized form
  const minutesStandalone = new RegExp(
    String.raw`(\d+)\s*хв\.?${noLetterAhead}`,
    'giu',
  )
  text = text.replace(
    minutesStandalone,
    (_, n) => `${n} ${pluralUA(n, 'хвилина', 'хвилини', 'хвилин')}`,
  )

  // 9) ZSU
  text = text.replace(/(?<!\p{L})ЗСУ\+(?!\p{L})/giu, 'зе-есу́ +')

  // 10) ALL TOGETHER uppercase normalization
  text = text.replace(/ВСЕ РАЗОМ/g, 'Все Рáзом')

  // 11) Accents
  text = text.replace(/(?<!\p{L})натисніть(?!\p{L})/giu, 'нати́снІть')
  text = text.replace(/(?<!\p{L})драйвовий(?!\p{L})/giu, 'драйво́вий')

  // 12) Мбіт\с Гбіт\с
  text = text.replace(
    /(?<!\p{L})(?:Мбіт[\\/]с)(?!\p{L})/giu,
    'мегабітів на секунду',
  )
  text = text.replace(
    /(?<!\p{L})(?:Гбіт[\\/]с)(?!\p{L})/giu,
    'гігабітів на секунду',
  )

  // 13) АП
  text = text.replace(/(?<!\p{L})(?:АП)(?!\p{L})/giu, 'абонентська плата')

  // 13) TV
  text = text.replace(/(?<!\p{L})(?:Т[ВБ])(?!\p{L})/giu, 'тебе')

  // 14) Unfinished lines will be closed with a semicolon
  text = text.replace(/(?<![.!?;\-–—]|\r?\n)(\r?\n)/g, ';$1')

  return text
}
