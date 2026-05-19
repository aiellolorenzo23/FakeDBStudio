export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export interface JsonObject {
  [key: string]: JsonValue
}

export type JsonArray = JsonValue[]

export interface TableRow {
  [column: string]: JsonValue
}

export type JsonTable = TableRow[]

export interface JsonSchema {
  [tableName: string]: JsonTable
}

export interface FakeDb {
  version: string
  schemas: {
    [schemaName: string]: JsonSchema
  }
}
