import EventEmitter from 'eventemitter3'
import { Handler, Listener, Persistence } from './agent'
import { Utils } from './utils'

type Channel = string

export class HandlerMap {

  private map: Map<Channel, WeakMap<Listener, Map<Persistence, Handler[]>>> = new Map()

  public constructor (private linkedEmitter: EventEmitter<string>) {}

  public set (channel: string, listener: Listener, persistence: Persistence, handler: Handler): number {
    const level1 = Utils.computeIfAbsent(this.map, channel, new WeakMap())
    const level2 = Utils.computeIfAbsent(level1, listener, new Map())
    const handlers = Utils.computeIfAbsent(level2, persistence, [] as Handler[])
    return handlers.push(handler)
  }

  public purge (channel: string, listener?: Listener): boolean {
    if (typeof listener === 'undefined') {
      this.linkedEmitter.removeAllListeners(channel)
      return this.map.delete(channel)
    } else {
      for (const handler of this.getAllHandlers(channel, listener)) {
        this.linkedEmitter.removeListener(channel, handler)
      }
      return this.map.get(channel)!.delete(listener)
    }
  }

  public delete (channel: string, listener: Listener, persistence: Persistence, handler: Handler): boolean {
    if (persistence === 'never') return false
    const level1 = this.map.get(channel)!
    const level2 = level1.get(listener)!
    const handlers = level2.get(persistence!)!
    const result = Utils.removeFromArray(handlers, handler)
    this.linkedEmitter.removeListener(channel, handler)
    if (handlers.length === 0) {
      level2.delete(persistence!)
      if (level2.size === 0) {
        level1.delete(listener)
        if (this.linkedEmitter.listenerCount(channel) === 0) {
          this.map.delete(channel)
        }
      }
    }
    return result
  }

  public clear (): boolean {
    const result = this.map.size > 0
    this.map.clear()
    this.linkedEmitter.removeAllListeners()
    return result
  }

  private getAllHandlers (channel: string, listener: Listener): Handler[] {
    if (this.map.has(channel)) {
      const level1 = this.map.get(channel)!
      if (level1.has(listener)) {
        const level2 = level1.get(listener)!
        const handlers: Handler[] = []
        const persistences: Persistence[] = ['on', 'once']
        for (const persistence of persistences) {
          if (level2.has(persistence)) {
            handlers.push(...level2.get(persistence)!)
          }
        }
        return handlers
      }
    }
    return []
  }

}
