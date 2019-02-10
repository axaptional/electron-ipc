import { Agent } from './agent';
import { ipcMain } from 'electron';
import WebContents = Electron.WebContents;
import { IpcMainEvent } from './aliases';
import IpcMain = Electron.IpcMain;

/**
 * Represents an API wrapper around Electron's ipcMain.
 */
export class Server extends Agent<IpcMain> {
  /**
   * Initializes a new IPC Server.
   * @param webContents The Electron WebContents of the renderer view to post messages to and receive messages from
   */
  constructor(private webContents: WebContents) {
    super(ipcMain);
  }

  /**
   * Sends a message to the renderer process.
   * @param requestChannel The channel to use for sending the request
   * @param data The request data
   */
  protected send(requestChannel: string, ...data: any[]): void {
    this.webContents.send(requestChannel, ...data);
  }

  /**
   * Responds to a given event from the renderer process.
   * @param event The event to respond to
   * @param responseChannel The channel to use for sending the response
   * @param data The response data
   */
  protected respond(event: IpcMainEvent, responseChannel: string, ...data: any[]): void {
    event.sender.send(responseChannel, ...data);
  }
}
