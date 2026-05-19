import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const fakeDbApi = {
  openDatabase: () => ipcRenderer.invoke('fake-db:open-database'),

  getRecentFiles: () => ipcRenderer.invoke('fake-db:get-recent-files'),

  openRecentDatabase: (filePath: string) =>
    ipcRenderer.invoke('fake-db:open-recent-database', filePath),

  saveDatabase: (filePath: string, content: string) =>
    ipcRenderer.invoke('fake-db:save-database', filePath, content),

  saveDatabaseAs: (content: string) => ipcRenderer.invoke('fake-db:save-database-as', content)
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
