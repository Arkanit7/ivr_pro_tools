import {pluralUA} from '@/lib/utils'

// IVR systems expect plain ASCII file names: Latin letters, digits, "_" and "-".
// The bulk page also allows "." because Excel names may already end in .wav/.alw.
const allowedChar = (allowDot) =>
  allowDot ? /^[a-zA-Z0-9_\-.]$/ : /^[a-zA-Z0-9_-]$/

export const isValidFileNameChar = (char, {allowDot = false} = {}) =>
  allowedChar(allowDot).test(char)

const describeChar = (char) =>
  ({' ': 'пробіл', '\t': 'табуляція', '\n': 'перенос рядка'})[char] ??
  `«${char}»`

const allowedHint = (allowDot) =>
  `Дозволені лише латинські літери, цифри, ${allowDot ? '«_», «-» та «.»' : '«_» та «-»'}.`

// What's wrong with a single name, or null if it's fine.
function getNameIssue(name, {allowDot = false, allowEmpty = false} = {}) {
  if (!name.trim()) return allowEmpty ? null : 'назва порожня'
  const bad = [...new Set(name)].filter((c) => !isValidFileNameChar(c, {allowDot}))
  if (bad.length === 0) return null
  return `${bad.length === 1 ? 'недопустимий символ' : 'недопустимі символи'}: ${bad.map(describeChar).join(', ')}`
}

export const isValidFileName = (name, options) =>
  getNameIssue(name, options) === null

// Names that save to the same file: the extension is replaced on save, and
// Windows / ZIP extraction treat "Menu" and "menu" as one file.
const fileKey = (name) => name.trim().replace(/\.(wav|alw)$/i, '').toLowerCase()

// Keys of names shared by items with different text (= different audio).
// Same name + same text is one group with one audio file, so that's harmless.
export function findConflictingNames(items) {
  const textsByKey = new Map()
  for (const {fileName, text} of items) {
    const key = fileKey(fileName)
    if (!key) continue
    if (!textsByKey.has(key)) textsByKey.set(key, new Set())
    textsByKey.get(key).add(text)
  }
  return new Set(
    [...textsByKey].filter(([, texts]) => texts.size > 1).map(([key]) => key),
  )
}

export const isConflictingName = (name, conflicts) => conflicts.has(fileKey(name))

// Tooltip text for "download all" when names collide, or null.
export function getDuplicateBlockReason(items) {
  const conflicts = findConflictingNames(items)
  if (conflicts.size === 0) return null

  // Every spelling of each conflict, e.g. «Menu» = «menu.wav», so the clash is visible
  const spellings = new Map()
  for (const {fileName} of items) {
    const key = fileKey(fileName)
    if (!conflicts.has(key)) continue
    if (!spellings.has(key)) spellings.set(key, new Set())
    spellings.get(key).add(fileName.trim())
  }
  const groups = [...spellings.values()].map((s) =>
    [...s].map((n) => `«${n}»`).join(' = '),
  )
  const more = groups.length > 3 ? ` та ще ${groups.length - 3}` : ''
  return `Неможливо завантажити: файли з різними промптами матимуть однакову назву — ${groups.slice(0, 3).join('; ')}${more}. В архіві один файл замінить інший (великі й малі літери та розширення .wav/.alw не враховуються). Перейменуйте файли, виділені в списку.`
}

// Tooltip text explaining why download is blocked, or null when every name is valid.
export function getDownloadBlockReason(names, options = {}) {
  const problems = names
    .map((name) => ({name, issue: getNameIssue(name, options)}))
    .filter((p) => p.issue)
  if (problems.length === 0) return null

  const hint = allowedHint(options.allowDot)
  if (problems.length === 1) {
    const [{name, issue}] = problems
    return `Неможливо завантажити: ${name.trim() ? `назва «${name}» містить ` : ''}${issue}. ${hint}`
  }

  const shown = problems
    .slice(0, 3)
    .map(({name, issue}) => `«${name}» (${issue})`)
    .join('; ')
  const more = problems.length > 3 ? ` та ще ${problems.length - 3}` : ''
  return `Неможливо завантажити: ${problems.length} ${pluralUA(problems.length, 'назва файлу має', 'назви файлів мають', 'назв файлів мають')} помилки — ${shown}${more}. ${hint}`
}
