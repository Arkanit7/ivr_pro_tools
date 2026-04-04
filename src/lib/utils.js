import {clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function pluralUA(n, one, few, many) {
  const abs = Math.abs(Number(n))
  const mod10 = abs % 10
  const mod100 = abs % 100

  if (mod10 === 1 && mod100 !== 11) return one // 1, 21, 31 → one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few // 2-4 → few

  return many // 0, 5-20, etc. → many
}
