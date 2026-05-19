import type { JsonValue } from '../model/fakeDb'
import { stringifyValue } from './jsonUtils'

export function isEmptySortableValue(value: JsonValue | undefined): boolean {
  return value === undefined || value === null || value === ''
}

export function compareSortableValues(
  left: JsonValue | undefined,
  right: JsonValue | undefined
): number {
  const leftIsEmpty = isEmptySortableValue(left)
  const rightIsEmpty = isEmptySortableValue(right)

  if (leftIsEmpty && rightIsEmpty) return 0
  if (leftIsEmpty) return 1
  if (rightIsEmpty) return -1

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }

  return stringifyValue(left).localeCompare(stringifyValue(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}
