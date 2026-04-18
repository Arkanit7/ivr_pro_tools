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

/**
 * @param {import('react-router').RouteObject[]} routes
 * @param {string} parentPath
 */
export function getRoutesWithTitles(routes, parentPath = '') {
  const result = []

  for (const route of routes) {
    let currentPath = parentPath

    if (route.path) currentPath += '/' + route.path

    if (route.handle?.title) {
      result.push({path: currentPath || '/', title: route.handle.title})
    }

    if (route.children) {
      result.push(...getRoutesWithTitles(route.children, currentPath))
    }
  }

  return result
}
