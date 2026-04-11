import type { DepartmentTreeItem } from '../types'

export type DepartmentOption = { id: number; name: string }

const normalizeDepartmentName = (value: string) => value.replace(/\s+/g, '')

export const flattenDepartments = (items: DepartmentTreeItem[], prefix = ''): DepartmentOption[] =>
  items.flatMap((item) => {
    const label = prefix ? `${prefix} / ${item.name}` : item.name
    return [{ id: item.id, name: label }, ...flattenDepartments(item.children || [], label)]
  })

export const findDepartmentNodeByName = (items: DepartmentTreeItem[], name: string): DepartmentTreeItem | null =>
  findDepartmentNodesByName(items, name)[0] || null

export const findDepartmentNodesByName = (items: DepartmentTreeItem[], name: string): DepartmentTreeItem[] => {
  const normalizedTarget = normalizeDepartmentName(name)
  const matched: DepartmentTreeItem[] = []

  for (const item of items) {
    if (normalizeDepartmentName(item.name) === normalizedTarget) {
      matched.push(item)
    }
    matched.push(...findDepartmentNodesByName(item.children || [], name))
  }

  return matched
}

export const flattenDepartmentSubtrees = (items: DepartmentTreeItem[], rootNames: string[]): DepartmentOption[] => {
  const seen = new Set<number>()
  const options: DepartmentOption[] = []

  for (const rootName of rootNames) {
    for (const node of findDepartmentNodesByName(items, rootName)) {
      for (const option of flattenDepartments([node])) {
        if (seen.has(option.id)) {
          continue
        }
        seen.add(option.id)
        options.push(option)
      }
    }
  }

  return options
}
