import {pluralUA} from '@/lib/utils'

const LB = String.raw`(?<!\p{L})` // no Unicode letter before
const LA = String.raw`(?!\p{L})` // no Unicode letter after

// Word-boundary regex for fixed-string patterns
function wbr(pattern, flags = 'giu') {
  return new RegExp(`${LB}(?:${pattern})${LA}`, flags)
}

// Accent / abbreviation map — add entries here to extend without code changes.
// Accents use U+0301 (COMBINING ACUTE ACCENT) placed after the stressed vowel.
const WORD_MAP = [
  ['мережа', 'мере́жа'],
  ['мережі', 'мере́жі'],
  ['мережу', 'мере́жу'],
  ['натисніть', 'нати́сніть'],
  ['натиснути', 'нати́снути'],
  ['драйвовий', 'драйво́вий'],
  ['RCS|РЦС', 'ер-це-ес'],
]
const WORD_REPLACEMENTS = WORD_MAP.map(([source, replacement]) => ({
  re: wbr(source),
  replacement,
}))

// Telecom abbreviations — add entries here to extend without code changes.
const TELECOM_MAP = [
  ['SMS|СМС', 'есемес'],
  ['АП', 'абонентська плата'],
  ['RLH|RLAH|РЛХ', 'роумінг як вдома'],
  ['ДІ', 'Домашній Інтернет'],
  ['Т[ВБ]', 'тебе'],
]
const TELECOM_REPLACEMENTS = TELECOM_MAP.map(([source, replacement]) => ({
  re: wbr(source),
  replacement,
}))

// Regex matching "<digits> <unit>[.]" with no letter after
function numUnit(unitPattern) {
  return new RegExp(String.raw`(\d+)\s*(?:${unitPattern})\.?${LA}`, 'giu')
}

// Applies numUnit replacement with Ukrainian plural forms
function replaceUnit(text, unitPattern, one, few, many) {
  return text.replace(
    numUnit(unitPattern),
    (_, n) => `${n} ${pluralUA(n, one, few, many)}`,
  )
}

// Callback for "N Xбіт/с" patterns; falls back to the many-form when N is absent
const speedCb = (one, few, many) => (_, n) =>
  n ? `${n} ${pluralUA(n, one, few, many)} на секунду` : `${many} на секунду`

export default function normalizeForTTS(input) {
  let text = String(input ?? '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')

  // --- Currency ---
  // Compound forms (грн/міс, грн/рік) must come before standalone грн
  text = text.replace(
    /(?:(\d+)\s*)?грн\.?\s*\/\s*м[іi]с(?!\p{L})/giu,
    (_, n) =>
      n
        ? `${n} ${pluralUA(n, 'гривня', 'гривні', 'гривень')} на місяць`
        : 'гривень на місяць',
  )
  text = text.replace(
    /(?:(\d+)\s*)?грн\.?\s*\/\s*р[іi]к(?!\p{L})/giu,
    (_, n) =>
      n
        ? `${n} ${pluralUA(n, 'гривня', 'гривні', 'гривень')} на рік`
        : 'гривень на рік',
  )
  text = replaceUnit(text, 'грн', 'гривня', 'гривні', 'гривень')
  text = text.replace(/\$\s*(\d+)|(\d+)\s*\$/gu, (_, pre, post) => {
    const n = pre ?? post
    return `${n} ${pluralUA(n, 'долар', 'долари', 'доларів')}`
  })
  text = text.replace(
    /€\s*(\d+)|(\d+)\s*€/gu,
    (_, pre, post) => `${pre ?? post} євро`,
  )
  text = replaceUnit(text, 'USD', 'долар', 'долари', 'доларів')
  text = text.replace(numUnit('EUR'), (_, n) => `${n} євро`)

  // --- Storage ---
  // text = replaceUnit(text, 'ТБ|TB', 'терабайт', 'терабайти', 'терабайтів')
  text = replaceUnit(text, 'ГБ|GB', 'гігабайт', 'гігабайти', 'гігабайтів')
  text = replaceUnit(text, 'МБ|MB', 'мегабайт', 'мегабайти', 'мегабайтів')
  text = replaceUnit(text, 'КБ|KB', 'кілобайт', 'кілобайти', 'кілобайтів')

  // --- Speed ---
  text = text.replace(
    /(?:(\d+)\s*)?Гбіт[\\/]с(?!\p{L})/giu,
    speedCb('гігабіт', 'гігабіти', 'гігабітів'),
  )
  text = text.replace(
    /(?:(\d+)\s*)?Мбіт[\\/]с(?!\p{L})/giu,
    speedCb('мегабіт', 'мегабіти', 'мегабітів'),
  )
  text = text.replace(
    /(?:(\d+)\s*)?Кбіт[\\/]с(?!\p{L})/giu,
    speedCb('кілобіт', 'кілобіти', 'кілобітів'),
  )

  // --- Time ---
  text = replaceUnit(text, 'год', 'година', 'години', 'годин')
  text = replaceUnit(text, 'хв', 'хвилина', 'хвилини', 'хвилин')
  text = replaceUnit(text, 'дн', 'день', 'дні', 'днів')
  text = replaceUnit(text, 'міс', 'місяць', 'місяці', 'місяців')

  // --- Percentages ---
  text = text.replace(
    /(\d+)\s*%/gu,
    (_, n) => `${n} ${pluralUA(n, 'відсоток', 'відсотки', 'відсотків')}`,
  )

  // --- Symbols ---
  text = text.replace(/№\s*(\d+)/g, 'номер $1')

  // --- Telecom abbreviations ---
  for (const {re, replacement} of TELECOM_REPLACEMENTS) {
    text = text.replace(re, replacement)
  }
  text = text.replace(/(?<!\p{L})ЗСУ\+(?!\p{L})/giu, 'зе-есу́ +') // + is part of the brand
  text = text.replace(/ВСЕ РАЗОМ/gi, 'Все Рáзом')
  text = text.replace(/LOVE UA/gi, 'лав юей')

  // --- Accents & word corrections ---
  for (const {re, replacement} of WORD_REPLACEMENTS) {
    text = text.replace(re, (match) => {
      const firstUp =
        match[0] !== match[0].toLowerCase() &&
        match[0] === match[0].toUpperCase()
      return firstUp
        ? replacement[0].toUpperCase() + replacement.slice(1)
        : replacement
    })
  }

  // --- Formatting ---
  text = text.replace(/(?<=\s)-(?=\s)/g, '—')
  text = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) =>
      block
        .split('\n')
        .map((line) => {
          const t = line.trimEnd()
          return /\p{P}$/u.test(t) ? t : t + '.'
        })
        .join('\n'),
    )
    .join('\n;\n')

  return text
}
