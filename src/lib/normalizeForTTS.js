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
  ['докладніше', 'докла́дніше'],
  ['детальніше', 'дета́льніше'],
  ['натисніть', 'нати́сніть'],
  ['натиснути', 'нати́снути'],
  ['драйвовий', 'драйво́вий'],
  ['RCS|РЦС', 'ер-це-ес'],
  ['США', 'С-Ш-А'],
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
  ['e-?SIM', 'єсім'],
]
const TELECOM_REPLACEMENTS = TELECOM_MAP.map(([source, replacement]) => ({
  re: wbr(source),
  replacement,
}))

// Integer or decimal number: "5", "1,5", "0.25"
const NUM = String.raw`\d+(?:[.,]\d+)?`

// Unit form for a number. After a decimal Ukrainian uses the genitive singular
// ("1,5 гігабайта"), which differs from the 2–4 form ("2 гігабайти").
const unitWord = (n, one, few, many, fraction) =>
  /[.,]/.test(n) ? fraction : pluralUA(n, one, few, many)

// Regex matching "<number> <unit>[.]" with no letter after
function numUnit(unitPattern) {
  return new RegExp(String.raw`(${NUM})\s*(?:${unitPattern})\.?${LA}`, 'giu')
}

// Applies numUnit replacement with Ukrainian plural forms
function replaceUnit(text, unitPattern, one, few, many, fraction) {
  return text.replace(
    numUnit(unitPattern),
    (_, n) => `${n} ${unitWord(n, one, few, many, fraction)}`,
  )
}

// Callback for "N Xбіт/с" patterns; falls back to the many-form when N is absent
const speedCb = (one, few, many, fraction) => (_, n) =>
  n
    ? `${n} ${unitWord(n, one, few, many, fraction)} на секунду`
    : `${many} на секунду`

// --- Numbers to words (used for decimals; integers are left for the TTS engine) ---
const ONES = ['', 'один', 'два', 'три', 'чотири', "п'ять", 'шість', 'сім', 'вісім', "дев'ять"]
const ONES_FEM = ['', 'одна', 'дві', ...ONES.slice(3)]
const TEENS = ['десять', 'одинадцять', 'дванадцять', 'тринадцять', 'чотирнадцять', "п'ятнадцять", 'шістнадцять', 'сімнадцять', 'вісімнадцять', "дев'ятнадцять"]
const TENS = ['', '', 'двадцять', 'тридцять', 'сорок', "п'ятдесят", 'шістдесят', 'сімдесят', 'вісімдесят', "дев'яносто"]
const HUNDREDS = ['', 'сто', 'двісті', 'триста', 'чотириста', "п'ятсот", 'шістсот', 'сімсот', 'вісімсот', "дев'ятсот"]
// [one, few, many, feminine] for thousands, millions, billions
const SCALES = [
  ['тисяча', 'тисячі', 'тисяч', true],
  ['мільйон', 'мільйони', 'мільйонів', false],
  ['мільярд', 'мільярди', 'мільярдів', false],
]

function hundredsToWords(n, feminine) {
  const rest = n % 100
  const tail =
    rest >= 10 && rest < 20
      ? [TEENS[rest - 10]]
      : [TENS[Math.floor(rest / 10)], (feminine ? ONES_FEM : ONES)[rest % 10]]
  return [HUNDREDS[Math.floor(n / 100)], ...tail].filter(Boolean).join(' ')
}

function numberToWords(n, {feminine = false} = {}) {
  if (n === 0) return 'нуль'
  if (n >= 1e12) return String(n)
  const groups = []
  for (let rest = n; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000)
  const words = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    if (!g) continue
    if (i === 0) {
      words.push(hundredsToWords(g, feminine))
    } else {
      const [one, few, many, fem] = SCALES[i - 1]
      words.push(hundredsToWords(g, fem), pluralUA(g, one, few, many))
    }
  }
  return words.join(' ')
}

// "ціла"/"десята" after 1, 21, 31… (but not 11); "цілих"/"десятих" otherwise
const takesSingular = (n) => n % 10 === 1 && n % 100 !== 11
const FRACTION_NAMES = {1: ['десята', 'десятих'], 2: ['сота', 'сотих'], 3: ['тисячна', 'тисячних']}

// 6.04 → "шість цілих чотири сотих"
function decimalToWords(intDigits, fracDigits) {
  const int = Number(intDigits)
  const frac = Number(fracDigits)
  const [fracOne, fracMany] = FRACTION_NAMES[fracDigits.length]
  return [
    numberToWords(int, {feminine: true}),
    takesSingular(int) ? 'ціла' : 'цілих',
    numberToWords(frac, {feminine: true}),
    takesSingular(frac) ? fracOne : fracMany,
  ].join(' ')
}

// A lone decimal with 1–3 fraction digits. Skips dates (15.11.2026), lists (1,2,3),
// versions (v2.5) and IP-like numbers: no letter, digit, "." or "," right before,
// and no digit or letter, or another ".digit"/",digit", right after.
const DECIMAL_RE = /(?<![\p{L}\d.,])(\d+)[.,](\d{1,3})(?![\d\p{L}])(?![.,]\d)/gu

export default function normalizeForTTS(input) {
  let text = String(input ?? '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')

  // --- Currency ---
  // Compound forms (грн/міс, грн/рік) must come before standalone грн
  const UAH = ['гривня', 'гривні', 'гривень', 'гривні']
  const USD = ['долар', 'долари', 'доларів', 'долара']
  text = text.replace(
    new RegExp(String.raw`(?:(${NUM})\s*)?грн\.?\s*\/\s*м[іi]с(?!\p{L})`, 'giu'),
    (_, n) =>
      n ? `${n} ${unitWord(n, ...UAH)} на місяць` : 'гривень на місяць',
  )
  text = text.replace(
    new RegExp(String.raw`(?:(${NUM})\s*)?грн\.?\s*\/\s*р[іi]к(?!\p{L})`, 'giu'),
    (_, n) => (n ? `${n} ${unitWord(n, ...UAH)} на рік` : 'гривень на рік'),
  )
  text = replaceUnit(text, 'грн', ...UAH)
  text = text.replace(
    new RegExp(String.raw`\$\s*(${NUM})|(${NUM})\s*\$`, 'gu'),
    (_, pre, post) => {
      const n = pre ?? post
      return `${n} ${unitWord(n, ...USD)}`
    },
  )
  text = text.replace(
    new RegExp(String.raw`€\s*(${NUM})|(${NUM})\s*€`, 'gu'),
    (_, pre, post) => `${pre ?? post} євро`,
  )
  text = replaceUnit(text, 'USD', ...USD)
  text = text.replace(numUnit('EUR'), (_, n) => `${n} євро`)

  // --- Storage ---
  // text = replaceUnit(text, 'ТБ|TB', 'терабайт', 'терабайти', 'терабайтів', 'терабайта')
  text = replaceUnit(text, 'ГБ|GB', 'гігабайт', 'гігабайти', 'гігабайтів', 'гігабайта')
  text = replaceUnit(text, 'МБ|MB', 'мегабайт', 'мегабайти', 'мегабайтів', 'мегабайта')
  text = replaceUnit(text, 'КБ|KB', 'кілобайт', 'кілобайти', 'кілобайтів', 'кілобайта')

  // --- Speed ---
  text = text.replace(
    new RegExp(String.raw`(?:(${NUM})\s*)?Гбіт[\\/]с(?!\p{L})`, 'giu'),
    speedCb('гігабіт', 'гігабіти', 'гігабітів', 'гігабіта'),
  )
  text = text.replace(
    new RegExp(String.raw`(?:(${NUM})\s*)?Мбіт[\\/]с(?!\p{L})`, 'giu'),
    speedCb('мегабіт', 'мегабіти', 'мегабітів', 'мегабіта'),
  )
  text = text.replace(
    new RegExp(String.raw`(?:(${NUM})\s*)?Кбіт[\\/]с(?!\p{L})`, 'giu'),
    speedCb('кілобіт', 'кілобіти', 'кілобітів', 'кілобіта'),
  )

  // --- Time ---
  text = replaceUnit(text, 'год', 'година', 'години', 'годин', 'години')
  text = replaceUnit(text, 'хв', 'хвилина', 'хвилини', 'хвилин', 'хвилини')
  text = replaceUnit(text, 'дн', 'день', 'дні', 'днів', 'дня')
  text = replaceUnit(text, 'міс', 'місяць', 'місяці', 'місяців', 'місяця')

  // --- Percentages ---
  text = text.replace(
    new RegExp(String.raw`(${NUM})\s*%`, 'gu'),
    (_, n) =>
      `${n} ${unitWord(n, 'відсоток', 'відсотки', 'відсотків', 'відсотка')}`,
  )

  // --- Decimals → words (after units, which need the digits to pick a form) ---
  text = text.replace(DECIMAL_RE, (_, int, frac) => decimalToWords(int, frac))

  // --- Mobile generations: 4G → 4джі ---
  text = text.replace(/(?<![\p{L}\d])([1-5])G(?!\p{L})/giu, '$1джі')

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

  // --- натисніть/натиснути + digit → spelled-out word ---
  const PRESS_DIGIT_WORDS = ['нуль', 'один', 'два', 'три', 'чотири', "п'ять", 'шість', 'сім', 'вісім', "дев'ять"]
  text = text.replace(
    /(нати́сніть|натисніть|нати́снути|натиснути)(\s+)([0-9])(?!\d)/gu,
    (_, keyword, space, digit) => keyword + space + PRESS_DIGIT_WORDS[+digit],
  )

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
