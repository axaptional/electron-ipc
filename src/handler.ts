import { IpcEvent } from './aliases'
import { AbstractMessage } from './message'
import { Utils } from './utils'

export type Persistence = 'on' | 'once' | 'never'

export type IpcListener = (event: IpcEvent, message: AbstractMessage) => void

export type TeardownFunction = (reason?: any) => void

/**
 * Represents a handler for an Electron IPC service event.
 */
export class Handler {

  public constructor (public run: IpcListener, public persistence: Persistence, private teardown?: TeardownFunction) {}

  public cancel (reason?: any): void {
    if (typeof this.teardown === 'function') this.teardown(reason)
  }

  public throw (error: any | Error): void {
    this.cancel(Utils.coerceToError(error))
  }

}
