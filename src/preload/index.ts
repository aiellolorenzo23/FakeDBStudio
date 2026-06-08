import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const fakeDbApi = {
  openDatabase: () => ipcRenderer.invoke('fake-db:open-database'),

  getRecentFiles: () => ipcRenderer.invoke('fake-db:get-recent-files'),

  removeRecentFile: (filePath: string) =>
    ipcRenderer.invoke('fake-db:remove-recent-file', filePath),

  getLastOpenedFile: () => ipcRenderer.invoke('fake-db:get-last-opened-file'),

  getQueryHistory: () => ipcRenderer.invoke('fake-db:get-query-history'),

  pushQueryHistoryEntry: (query: string) =>
    ipcRenderer.invoke('fake-db:push-query-history-entry', query),

  removeQueryHistoryEntry: (query: string) =>
    ipcRenderer.invoke('fake-db:remove-query-history-entry', query),

  openRecentDatabase: (filePath: string) =>
    ipcRenderer.invoke('fake-db:open-recent-database', filePath),

  reloadDatabase: (filePath: string) => ipcRenderer.invoke('fake-db:reload-database', filePath),

  saveDatabase: (filePath: string, content: string) =>
    ipcRenderer.invoke('fake-db:save-database', filePath, content),

  saveDatabaseAs: (content: string) => ipcRenderer.invoke('fake-db:save-database-as', content),

  watchDatabase: (filePath: string | null) => ipcRenderer.invoke('fake-db:watch-database', filePath),

  onDatabaseFileChanged: (callback: (payload: { filePath: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { filePath: string }): void => {
      callback(payload)
    }

    ipcRenderer.on('fake-db:database-file-changed', listener)

    return () => {
      ipcRenderer.removeListener('fake-db:database-file-changed', listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('fakeDb', fakeDbApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.electron = electronAPI
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.fakeDb = fakeDbApi
}
