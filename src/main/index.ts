import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import os from 'os'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import pty from 'node-pty'

const terminals = new Map<string, pty.IPty>()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerTerminalIpc(): void {
  ipcMain.handle('terminal:create', (event, options?: { cols?: number; rows?: number; cwd?: string }) => {
    const id = crypto.randomUUID()
    const shellPath = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : 'zsh')
    const term = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: options?.cols ?? 120,
      rows: options?.rows ?? 32,
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, TERM: 'xterm-256color' }
    })

    terminals.set(id, term)

    term.onData((data) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal:data', { id, data })
      }
    })

    term.onExit(({ exitCode }) => {
      terminals.delete(id)
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal:exit', { id, exitCode })
      }
    })

    return { id, cwd: options?.cwd || process.cwd(), title: os.userInfo().username }
  })

  ipcMain.on('terminal:write', (_event, payload: { id: string; data: string }) => {
    terminals.get(payload.id)?.write(payload.data)
  })

  ipcMain.on('terminal:resize', (_event, payload: { id: string; cols: number; rows: number }) => {
    terminals.get(payload.id)?.resize(Math.max(2, payload.cols), Math.max(1, payload.rows))
  })

  ipcMain.on('terminal:dispose', (_event, id: string) => {
    const term = terminals.get(id)
    terminals.delete(id)
    term?.kill()
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerTerminalIpc()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  for (const term of terminals.values()) term.kill()
  terminals.clear()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
