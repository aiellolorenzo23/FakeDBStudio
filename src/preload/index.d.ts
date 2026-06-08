import type { ElectronAPI } from '@electron-toolkit/preload'

export interface OpenDatabaseResult {
  canceled: boolean
  filePath?: string
  content?: string
  error?: string
}

export interface SaveDatabaseResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export interface ReloadDatabaseResult {
  success: boolean
  filePath?: string
  content?: string
  error?: string
}

export interface WatchDatabaseResult {
  success: boolean
  error?: string
}

export interface RecentFileEntry {
  filePath: string
  databaseName: string
}

export interface FakeDbApi {
  openDatabase: () => Promise<OpenDatabaseResult>

  getRecentFiles: () => Promise<RecentFileEntry[]>

  removeRecentFile: (filePath: string) => Promise<string[]>

  getLastOpenedFile: () => Promise<string | null>

  getQueryHistory: () => Promise<string[]>

  pushQueryHistoryEntry: (query: string) => Promise<string[]>

  removeQueryHistoryEntry: (query: string) => Promise<string[]>

  openRecentDatabase: (filePath: string) => Promise<OpenDatabaseResult>

  reloadDatabase: (filePath: string) => Promise<ReloadDatabaseResult>

  saveDatabase: (filePath: string, content: string) => Promise<SaveDatabaseResult>

  saveDatabaseAs: (content: string) => Promise<SaveDatabaseResult>

  watchDatabase: (filePath: string | null) => Promise<WatchDatabaseResult>

  onDatabaseFileChanged: (callback: (payload: { filePath: string }) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    fakeDb: FakeDbApi
  }
}
