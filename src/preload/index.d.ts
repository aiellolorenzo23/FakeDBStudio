import type { ElectronAPI } from '@electron-toolkit/preload'

export interface OpenDatabaseResult {
  canceled: boolean
  filePath?: string
  content?: string
}

export interface SaveDatabaseResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export interface FakeDbApi {
  openDatabase: () => Promise<OpenDatabaseResult>

  saveDatabase: (filePath: string, content: string) => Promise<SaveDatabaseResult>

  saveDatabaseAs: (content: string) => Promise<SaveDatabaseResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    fakeDb: FakeDbApi
  }
}
