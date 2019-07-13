import { IpcEvent } from './aliases'
import { AbstractMessage } from './message'

export type Persistence = 'on' | 'once' | 'never'

export type IpcListener = (event: IpcEvent, message: AbstractMessage) => void

export type TeardownFunction = (reason?: any) => void

/**
 * Represents a handler for an Electron IPC service event.
 */
export interface Handler {
  persistence: Persistence,
  run: IpcListener,
  teardown?: TeardownFunction
}

export function teardownIfPossible (handler: Handler) {
  if (typeof handler.teardown === 'function') handler.teardown()
}
