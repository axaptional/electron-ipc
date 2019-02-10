import IpcMain = Electron.IpcMain;
import IpcRenderer = Electron.IpcRenderer;

export type IpcMainEvent = Electron.Event;

/**
 * Represents an Electron event as received when listening with ipcRenderer.
 */
export interface IpcRendererEvent {
  /**
   * The Electron WebContents ID of the renderer view in the main process.
   */
  senderId: number;
}

export type IpcService = IpcMain | IpcRenderer;
export type IpcEvent = IpcMainEvent | IpcRendererEvent;
