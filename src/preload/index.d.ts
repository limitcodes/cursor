import { ElectronAPI } from '@electron-toolkit/preload'

export interface TerminalApi {
  create(options?: { cols?: number; rows?: number; cwd?: string }): Promise<{
    id: string
    cwd: string
    title: string
  }>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  dispose(id: string): void
  onData(callback: (payload: { id: string; data: string }) => void): () => void
  onExit(callback: (payload: { id: string; exitCode: number }) => void): () => void
}

export interface AppApi {
  terminal: TerminalApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
