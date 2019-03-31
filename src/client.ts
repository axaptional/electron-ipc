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
   * @param message The message to send
   */
  protected send (message: Message): void {
    this.ipcService.send(Client.ipcChannel, message)
  }

}
