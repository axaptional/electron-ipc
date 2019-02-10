import { Agent } from './agent';
import { ipcRenderer } from 'electron';
import { IpcRenderer, IpcRendererEvent } from './aliases';

/**
 * Represents an API wrapper around Electron's ipcRenderer.
 */
export class Client extends Agent<IpcRenderer> {
  /**
   * Initializes a new IPC Client.
   */
  constructor() {
    super(ipcRenderer);
  }

  /**
   * Sends a message to the main process.
   * @param requestChannel The channel to use for sending the request
   * @param data The request data
   */
  protected send(requestChannel: string, ...data: any[]): void {
    this.ipcService.send(requestChannel, ...data);
  }

  /**
   * Responds to a given event from the main process.
   * @param event The event to respond to
   * @param responseChannel The channel to use for sending the response
   * @param data The response data
   */
  protected respond(event: IpcRendererEvent, responseChannel: string, ...data: any[]): void {
    this.ipcService.sendTo(event.senderId, responseChannel, ...data);
  }
}
