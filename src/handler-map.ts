import EventEmitter from 'eventemitter3'
import { Listener } from './agent'
import { Handler, teardownIfPossible } from './handler'
import { Utils } from './utils'

type Channel = string

export class HandlerMap {

  private map: Map<Channel, WeakMap<Listener, Handler[]>> = new Map()

  private channelMap: Map<Channel, Handler[]> = new Map()

  public constructor (private linkedEmitter: EventEmitter<string>) {}

  // TODO: Remove channel entry from channelMap if handler array is empty
  // TODO: Make attempts to remove non-existent handlers NOT throw an exception

  public set (channel: string, listener: Listener, handler: Handler): number {
    const listeners = Utils.computeIfAbsent(this.map, channel, new WeakMap())
    const handlers = Utils.computeIfAbsent(listeners, listener, [] as Handler[])
    if (!this.channelMap.has(channel)) {
      this.channelMap.set(channel, [handler])
    } else {
      this.channelMap.get(channel)!.push(handler)
    }
    return handlers.push(handler)
  }

  public purge (channel: string, listener?: Listener): boolean {
    if (typeof listener === 'undefined') {
      this.linkedEmitter.removeAllListeners(channel)
      this.cancelAll(channel)
      this.channelMap.delete(channel)
      return this.map.delete(channel)
    } else {
      for (const handler of this.getAllHandlers(channel, listener)) {
        this.linkedEmitter.removeListener(channel, handler.run)
        teardownIfPossible(handler)
        Utils.removeFromArray(this.channelMap.get(channel)!, handler)
      }
      return this.map.get(channel)!.delete(listener)
    }
  }

  public delete (channel: string, listener: Listener, handler: Handler): boolean {
    const listeners = this.map.get(channel)!
    const handlers = listeners.get(listener)!
    const result = Utils.removeFromArray(handlers, handler)
    Utils.removeFromArray(this.channelMap.get(channel)!, handler)
    this.linkedEmitter.removeListener(channel, handler.run)
    teardownIfPossible(handler)
    if (handlers.length === 0) {
      listeners.delete(listener)
      if (this.linkedEmitter.listenerCount(channel) === 0) {
        this.map.delete(channel)
      }
    }
    return result
  }

  public clear (): boolean {
    const result = this.map.size > 0
    this.linkedEmitter.removeAllListeners()
    this.cancelAll()
    this.map.clear()
    this.channelMap.clear()
    return result
  }

  private getAllHandlers (channel: string, listener: Listener): Handler[] {
    if (this.map.has(channel)) {
      const listeners = this.map.get(channel)!
      if (listeners.has(listener)) {
        return listeners.get(listener)!
      }
    }
    return []
  }

  private cancelAll (channel?: string): void {
    const channels: string[] = []
    if (typeof channel !== 'undefined') {
      channels.push(channel)
    } else {
      channels.push(...this.channelMap.keys())
    }
    for (const ch of channels) {
      for (const handler of this.channelMap.get(ch)!) {
        teardownIfPossible(handler)
      }
    }
  }

}
