import type { JsonValue } from '../model/fakeDb'

export function stringifyValue(value: JsonValue | undefined): string {
  if (value === undefined) return ''
  if (value === null) return 'null'

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}
