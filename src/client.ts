import { Agent, Message } from './agent'
import { IpcRenderer } from './aliases'

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
   * @param channel The channel to use for sending the data
   * @param message The message to send
   */
  protected send (channel: string, message: Message): void {
    this.ipcService.send(channel, message)
  }

}
