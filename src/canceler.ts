import { Handler } from './agent'
import { IpcService } from './aliases'

/**
 * Represents a process that can be aborted.
 */
export interface Cancelable {
  /**
   * Cancels the process.
   */
  cancel (): void
}

export function isCancelable (object: any): object is Cancelable {
  return typeof object.cancel === 'function'
}

/**
 * Represents a helper to unsubscribe a listener function from a channel.
 */
export class Canceler implements Cancelable {
  /**
   * Initializes a new Canceler.
   * @param ipcService The IPC service to use for unsubscribing
   * @param channel The channel to unsubscribe from
   * @param handler The handler to unsubscribe
   */
  constructor (private ipcService: IpcService, public channel: string, private handler: Handler) {}

  /**
   * Unsubscribes the listener, meaning it will no longer be called when a message is received.
   */
  public cancel (): void {
    this.ipcService.removeListener(this.channel, this.handler)
  }
}
