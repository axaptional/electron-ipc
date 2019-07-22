import EventEmitter from 'eventemitter3'
import { Listener } from './agent'
import { Handler } from './handler'
import { defined, Utils } from './utils'

type Channel = string

export class HandlerMap {

  private map: Map<Channel, WeakMap<Listener, Set<Handler>>> = new Map()

  // NOTE: Since handlers are always uniquely created for each registration, they can be put into a set.
  private channelMap: Map<Channel, Set<Handler>> = new Map()

  public constructor (private linkedEmitter: EventEmitter<string>) {}

  // TODO: Remove channel entry from channelMap if handler array is empty

  public add (channel: string, listener: Listener, handler: Handler): void {
    const listeners = Utils.computeIfAbsent(this.map, channel, new WeakMap())
    const handlers = Utils.computeIfAbsent(listeners, listener, new Set())
    const channelHandlers = Utils.computeIfAbsent(this.channelMap, channel, new Set())
    channelHandlers.add(handler)
    handlers.add(handler)
  }

  public purge (channel: string, listener?: Listener): boolean {
    if (defined(listener)) {
      for (const handler of this.getAllHandlers(channel, listener)) {
        this.linkedEmitter.removeListener(channel, handler.run)
        handler.cancel()
        Utils.removeIfPresent(this.channelMap, channel, handler)
      }
      return Utils.removeIfPresent(this.map, channel, listener)
    } else {
      this.linkedEmitter.removeAllListeners(channel)
      this.cancelAll(channel)
      this.channelMap.delete(channel)
      return this.map.delete(channel)
    }
  }

  public delete (channel: string, listener: Listener, handler: Handler): boolean {
    if (!this.map.has(channel)) return false
    const listeners = this.map.get(channel)!
    if (!listeners.has(listener)) return false
    const handlers = listeners.get(listener)!
    const result = handlers.delete(handler)
    Utils.removeIfPresent(this.channelMap, channel, handler)
    this.linkedEmitter.removeListener(channel, handler.run)
    handler.cancel()
    if (handlers.size === 0) {
      listeners.delete(listener)
      if (this.linkedEmitter.listenerCount(channel) === 0) {
        this.map.delete(channel)
        this.channelMap.delete(channel)
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

  private getAllHandlers (channel: string, listener: Listener): Set<Handler> {
    if (this.map.has(channel)) {
      const listeners = this.map.get(channel)!
      if (listeners.has(listener)) {
        return listeners.get(listener)!
      }
    }
    return new Set()
  }

  private cancelAll (channel?: string): void {
    const channels: string[] = []
    if (defined(channel) && this.channelMap.has(channel)) {
      channels.push(channel)
    } else {
      channels.push(...this.channelMap.keys())
    }
    for (const ch of channels) {
      for (const handler of this.channelMap.get(ch)!) {
        handler.cancel()
      }
    }
  }

}
