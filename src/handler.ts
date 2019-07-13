import { IpcEvent } from './aliases'
import { AbstractMessage } from './message'

export type Persistence = 'on' | 'once' | 'never'

export type IpcListener = (event: IpcEvent, message: AbstractMessage) => void

export type TeardownFunction = (reason?: any) => void

/**
 * Represents a handler for an Electron IPC service event.
 */
export class Handler {

  public constructor (public run: IpcListener, public persistence: Persistence, private teardown?: TeardownFunction) {}

  public cancel (): void {
    if (typeof this.teardown === 'function') this.teardown()
  }

}
