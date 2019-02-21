import { Agent } from './agent'
import { IpcRenderer, IpcRendererEvent } from './aliases'

/**
 * Represents an API wrapper around Electron's ipcRenderer.
 */
export class Client extends Agent<IpcRenderer> {
  /**
   * Initializes a new IPC Client.
   */
  constructor () {
    super(require('electron').ipcRenderer)
  }

  /**
   * Sends a message to the main process.
   * @param channel The channel to use for sending the request
   * @param data The request data
   */
  protected send (channel: string, ...data: any[]): void {
    this.ipcService.send(channel, ...data)
  }
}
