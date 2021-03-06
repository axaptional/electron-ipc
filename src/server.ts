import { Agent } from './agent'
import { IpcMain, WebContents } from './aliases'
import { AbstractMessage } from './message'

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
   * @param message The message to send
   */
  protected send (message: AbstractMessage): void {
    this.webContents.send(Server.ipcChannel, message)
  }

}
