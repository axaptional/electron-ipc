import { Agent } from './agent'
import { IpcMain, IpcMainEvent, WebContents } from './aliases'

/**
 * Represents an API wrapper around Electron's ipcMain.
 */
export class Server extends Agent<IpcMain> {
  /**
   * Initializes a new IPC Server.
   * @param webContents The Electron WebContents of the renderer view to post messages to and receive messages from
   */
  constructor (private webContents: WebContents) {
    super(require('electron').ipcMain)
  }

  /**
   * Sends a message to the renderer process.
   * @param channel The channel to use for sending the request
   * @param data The request data
   */
  protected send (channel: string, ...data: any[]): void {
    this.webContents.send(channel, ...data)
  }
}
