import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { mkdir, readFile, writeFile } from 'fs/promises'

const RECENT_FILES_LIMIT = 8
const QUERY_HISTORY_LIMIT = 20
const recentFilesPath = join(app.getPath('userData'), 'recent-files.json')
const lastOpenedFilePath = join(app.getPath('userData'), 'last-opened-file.json')
const queryHistoryPath = join(app.getPath('userData'), 'query-history.json')

async function readRecentFiles(): Promise<string[]> {
  try {
    const content = await readFile(recentFilesPath, 'utf-8')
    const parsed = JSON.parse(content) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

async function writeRecentFiles(filePaths: string[]): Promise<void> {
  await mkdir(join(recentFilesPath, '..'), { recursive: true })
  await writeFile(recentFilesPath, JSON.stringify(filePaths, null, 2), 'utf-8')
}

async function readLastOpenedFile(): Promise<string | null> {
  try {
    const content = await readFile(lastOpenedFilePath, 'utf-8')
    const parsed = JSON.parse(content) as unknown

    return typeof parsed === 'string' ? parsed : null
  } catch {
    return null
  }
}

async function writeLastOpenedFile(filePath: string | null): Promise<void> {
  await mkdir(join(lastOpenedFilePath, '..'), { recursive: true })
  await writeFile(lastOpenedFilePath, JSON.stringify(filePath, null, 2), 'utf-8')
}

async function readQueryHistory(): Promise<string[]> {
  try {
    const content = await readFile(queryHistoryPath, 'utf-8')
    const parsed = JSON.parse(content) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

async function writeQueryHistory(entries: string[]): Promise<void> {
  await mkdir(join(queryHistoryPath, '..'), { recursive: true })
  await writeFile(queryHistoryPath, JSON.stringify(entries, null, 2), 'utf-8')
}

async function pushQueryHistoryEntry(query: string): Promise<string[]> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return readQueryHistory()
  }

  const currentEntries = await readQueryHistory()
  const nextEntries = [
    normalizedQuery,
    ...currentEntries.filter((entry) => entry !== normalizedQuery)
  ].slice(0, QUERY_HISTORY_LIMIT)

  await writeQueryHistory(nextEntries)
  return nextEntries
}

async function removeQueryHistoryEntry(query: string): Promise<string[]> {
  const normalizedQuery = query.trim()
  const currentEntries = await readQueryHistory()
  const nextEntries = currentEntries.filter((entry) => entry !== normalizedQuery)

  await writeQueryHistory(nextEntries)
  return nextEntries
}

async function pushRecentFile(filePath: string): Promise<void> {
  const currentRecentFiles = await readRecentFiles()
  const nextRecentFiles = [
    filePath,
    ...currentRecentFiles.filter((entry) => entry !== filePath)
  ].slice(0, RECENT_FILES_LIMIT)

  await writeRecentFiles(nextRecentFiles)
  await writeLastOpenedFile(filePath)
}

async function removeRecentFile(filePath: string): Promise<void> {
  const currentRecentFiles = await readRecentFiles()
  const nextRecentFiles = currentRecentFiles.filter((entry) => entry !== filePath)
  const currentLastOpenedFile = await readLastOpenedFile()

  await writeRecentFiles(nextRecentFiles)

  if (currentLastOpenedFile === filePath) {
    await writeLastOpenedFile(null)
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 1320,
    minHeight: 820,
    show: false,
    title: 'FakeDB Studio',
    icon,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setName('FakeDB Studio')

ipcMain.handle('fake-db:open-database', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open JSON Database',
    properties: ['openFile'],
    filters: [
      {
        name: 'JSON files',
        extensions: ['json']
      }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return {
      canceled: true
    }
  }

  const filePath = result.filePaths[0]
  const content = await readFile(filePath, 'utf-8')
  await pushRecentFile(filePath)

  return {
    canceled: false,
    filePath,
    content
  }
})

ipcMain.handle('fake-db:save-database', async (_, filePath: string, content: string) => {
  try {
    await writeFile(filePath, content, 'utf-8')
    await pushRecentFile(filePath)

    return {
      success: true,
      filePath
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('fake-db:save-database-as', async (_, content: string) => {
  const result = await dialog.showSaveDialog({
    title: 'Save JSON Database As',
    defaultPath: 'database.json',
    filters: [
      {
        name: 'JSON files',
        extensions: ['json']
      }
    ]
  })

  if (result.canceled || !result.filePath) {
    return {
      success: false,
      canceled: true
    }
  }

  try {
    await writeFile(result.filePath, content, 'utf-8')
    await pushRecentFile(result.filePath)

    return {
      success: true,
      filePath: result.filePath
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

ipcMain.handle('fake-db:get-recent-files', async () => {
  return readRecentFiles()
})

ipcMain.handle('fake-db:get-last-opened-file', async () => {
  return readLastOpenedFile()
})

ipcMain.handle('fake-db:get-query-history', async () => {
  return readQueryHistory()
})

ipcMain.handle('fake-db:push-query-history-entry', async (_, query: string) => {
  return pushQueryHistoryEntry(query)
})

ipcMain.handle('fake-db:remove-query-history-entry', async (_, query: string) => {
  return removeQueryHistoryEntry(query)
})

ipcMain.handle('fake-db:open-recent-database', async (_, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    await pushRecentFile(filePath)

    return {
      canceled: false,
      filePath,
      content
    }
  } catch (error) {
    await removeRecentFile(filePath)

    return {
      canceled: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.fakedb.workbench')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
