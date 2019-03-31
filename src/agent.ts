import Promise from 'any-promise'
import EventEmitter from 'eventemitter3'
import { IpcEvent, IpcService } from './aliases'
import { OptionsProvider, OptionsStore } from './options'

/**
 * Represents a source of a response.
 * The actual response can be resolved synchronously or asynchronously.
 */
export type ResponseSource<T> = Promise.Thenable<T> | T

/**
 * Represents a listener function.
 * Responses may be emitted as return values.
 */
export type Listener = (data: any) => ResponseSource<any>

/**
 * Represents a handler for an Electron IPC service event.
 */
export type Handler = (event: IpcEvent, message: Message) => void

/**
 * Represents a proxy handler for responses.
 */
export type ResponseHandler = (response: any) => void

export type Task = () => void

/**
 * Represents a set of options for handling listener arguments and return values.
 */
export interface Options {
  /**
   * If true, success listeners take (err, data) arguments and error listeners are disallowed.
   */
  nodeCallbacks: boolean
}

export interface Message {
  data?: any,
  channel: string,
  response: boolean,
  error: boolean
}

type HandlerMap = Map<string, Set<Handler>>

/**
 * Represents an IPC communicator through which messages can be posted and received.
 */
export abstract class Agent<T extends IpcService> implements OptionsProvider<Options> {

  /**
   * The channel used for communication by "electron-ipc".
   */
  public static readonly ipcChannel: string = '$electron-ipc'

  /**
   * The set of options used by all instances by default.
   */
  private static readonly fallbackOptions: Options = {
    nodeCallbacks: false
  }

  /**
   * The set of options used for this instance.
   */
  protected readonly options: OptionsStore<Options>

  /**
   * The EventEmitter used for emitting data of incoming requests.
   */
  protected readonly requestEvents: EventEmitter<any> = new EventEmitter()

  /**
   * The EventEmitter used for emitting data of incoming responses.
   */
  protected readonly responseEvents: EventEmitter<any> = new EventEmitter()

  /**
   * A listener-handler-pair collection tracking active listeners.
   */
  private handlers: WeakMap<Listener, HandlerMap> = new WeakMap()

  /**
   * Initializes a new Agent for the given Electron IPC service.
   * @param ipcService Either the ipcMain or the ipcRenderer service from Electron
   * @param defaultOptions A set of options to use by default for all message handlers
   */
  protected constructor (protected ipcService: T, defaultOptions?: Partial<Options>) {
    this.options = new OptionsStore(Agent.fallbackOptions, defaultOptions)
    ipcService.on(Agent.ipcChannel, this.onDataReceived)
  }

  /**
   * Overrides the default settings of this IPC communicator instance.
   * Settings not specified in the options argument will retain their values by default.
   * @param options A set of options with settings you want to override
   * @param replace If true, the default options will be completely replaced instead of partially overwritten
   */
  public configure (options: Partial<Options>, replace?: boolean): void {
    this.options.configure(options, replace)
  }

  /**
   * Posts a message to the given channel.
   * The Promise resolves either when a response is received or when the listening endpoint terminates.
   * @param channel The channel to post to
   * @param data The message to post
   */
  public post (channel: string, data: any): Promise<any>

  /**
   * Posts a message to the given channel.
   * The listener is called either when a response is received or when the listening endpoint terminates.
   * @param channel The channel to post to
   * @param data The message to post
   * @param listener The listener to call once the response was received
   */
  public post (channel: string, data: any, listener: ResponseHandler): void

  // TODO: The Promise should be rejected if an uncaught error occurred at the listening endpoint.
  /**
   * Posts a message to the given channel and calls the listener when a response is received.
   * If no response is given, the listener will be called with an undefined response instead.
   * If no listener is given, a Promise is returned instead.
   * @param channel The channel to post to
   * @param data The message to post
   * @param listener The listener to call once the response was received
   */
  public post (channel: string, data: any, listener?: ResponseHandler): Promise<any> | void {
    const message: Message = this.constructMessage(channel, data)
    if (typeof listener !== 'undefined') {
      this.postListener(channel, message, listener)
    } else {
      return this.postPromise(channel, message)
    }
  }

  /**
   * Sends a response on the given channel.
   * @param channel The channel to respond to
   * @param data The response data
   */
  public respond (channel: string, data: any): void {
    const message: Message = this.constructMessage(channel, data, true)
    this.send(message)
  }

  /**
   * Listens for messages on the given channel and calls the given listener when a message is received.
   * To send a response, simply have the listener function return a value or a Promise.
   * @param channel The channel to listen to
   * @param listener The listener to call for each received message
   * @param options A set of options to override the default options for this call only
   */
  public on (channel: string, listener: Listener, options?: Partial<Options>): void {
    const params = this.options.get(options)
    const handler: Handler = this.getHandler(channel, listener)
    this.requestEvents.on(channel, handler)
    this.pushHandler(channel, listener, handler)
  }

  /**
   * Listens for a message on the given channel and calls the given listener when it is received.
   * To send a response, simply have the listener function return a value or a Promise.
   * @param channel The channel to listen to
   * @param listener The listener to call once the message was received
   * @param options A set of options to override the default options for this call only
   */
  public once (channel: string, listener: Listener, options?: Partial<Options>): void {
    const params = this.options.get(options)
    const handler: Handler = this.getHandler(channel, listener, () => {
      this.handlers.delete(listener)
    })
    this.requestEvents.once(channel, handler)
    this.pushHandler(channel, listener, handler)
  }

  /**
   * Captures the next message on the given channel. The Promise resolves once a message was received.
   * Canceling is only possible through the use of an additional library like Bluebird, not with native Promises.
   * @param channel The channel to listen to
   * @param options A set of options to override the default options for this call only
   */
  public capture (channel: string, options?: Partial<Options>): Promise<any> {
    const params = this.options.get(options)
    return new Promise((resolve) => {
      const handler: Handler = this.getWrapperHandler(resolve)
      this.requestEvents.once(channel, handler)
    })
  }

  /**
   * Removes all subscriptions of a listener from the given channel.
   * @param channel The channel whose subscriptions tied to the listener should be removed
   * @param listener The listener whose subscriptions tied to the channel should be removed
   */
  public removeListener (channel: string, listener: Listener): void {
    if (this.handlers.has(listener)) {
      const handlers = this.pullHandlers(channel, listener)
      for (const handler of handlers) {
        /*
          NOTE: Some handlers may be "phantoms", meaning they have already been removed from the ipcService despite
          still being present in the handler set. In this case, the next line will still try to remove that "listener".
          In other words, this behavior only works because ipcService.removeListener() does not throw an Error when
          an attempt to remove an unattached listener is made.
         */
        this.requestEvents.removeListener(channel, handler)
      }
    }
  }

  /**
   * Removes all subscriptions of all listeners from all channels.
   */
  public removeAllListeners (): void

  /**
   * Removes all subscriptions of all listeners from the given channel.
   * @param channel The channel to unsubscribe from
   */
  public removeAllListeners (channel?: string): void {
    let channelsToClear: string[] = []
    if (typeof channel !== 'undefined') {
      channelsToClear.push(channel)
    } else {
      channelsToClear = this.requestEvents.eventNames()
    }
    for (const channelToClear of channelsToClear) {
      this.requestEvents.removeAllListeners(channelToClear)
    }
  }

  protected pushHandler (channel: string, listener: Listener, handler: Handler): void {
    if (!this.handlers.has(listener)) {
      this.handlers.set(listener, new Map())
    }
    const handlerMap = this.handlers.get(listener)!
    if (!handlerMap.has(channel)) {
      handlerMap.set(channel, new Set())
    }
    const handlerSet = handlerMap.get(channel)!
    handlerSet.add(handler)
  }

  protected pullHandlers (channel: string, listener: Listener): Set<Handler> {
    if (!this.handlers.has(listener)) {
      return new Set()
    }
    const handlerMap = this.handlers.get(listener)!
    if (!handlerMap.has(channel)) {
      return new Set()
    }
    const handlerSet = handlerMap.get(channel)!
    handlerMap.delete(channel)
    if (handlerMap.size === 0) {
      this.handlers.delete(listener)
    }
    return handlerSet
  }

  protected constructMessage (channel: string, data: any | Error, response: boolean = false): Message {
    const error = data instanceof Error
    const message: Message = { channel, data, error, response }
    if (typeof data === 'undefined') {
      delete message.data
    }
    return message
  }

  protected deconstructMessage (message: Message): any {
    let { data } = message
    if (message.error) {
      data = new Error(message.data.message)
      data.name = message.data.name
    }
    return data
  }

  /**
   * Sends a message to the other service.
   * @param message The message to send
   */
  protected abstract send (message: Message): void

  protected getHandler (channel: string, listener: Listener, teardown?: Task): Handler {
    return (event: IpcEvent, message: Message) => {
      const respond: ResponseHandler = (response: any) => this.respond(channel, response)
      const data = this.deconstructMessage(message)
      const responseSource: ResponseSource<any> = listener(data)
      if (responseSource instanceof Promise) {
        responseSource.then(respond)
      } else {
        respond(responseSource)
      }
      if (typeof teardown === 'function') {
        teardown()
      }
    }
  }

  protected getWrapperHandler (callback: ResponseHandler): Handler {
    return (event: IpcEvent, response: Message) => {
      const data = this.deconstructMessage(response)
      callback(data)
    }
  }

  /**
   * Listener for incoming messages. Redistributes message data to specialized EventEmitters.
   * @param ipcEvent The Electron IPC event
   * @param message The message that was received
   */
  private onDataReceived (ipcEvent: IpcEvent, message: Message) {
    const data: any = this.deconstructMessage(message)
    const emitter: EventEmitter = (message.response) ? this.responseEvents : this.requestEvents
    emitter.emit(message.channel, data)
  }

  /**
   * Posts a message to the given channel.
   * The Promise resolves either when a response is received or when the listening endpoint terminates.
   * @param channel The channel to use for communication
   * @param message The message to post
   */
  private postPromise (channel: string, message: Message): Promise<any> {
    const responsePromise = new Promise((resolve) => {
      const handler: Handler = this.getWrapperHandler(resolve)
      this.responseEvents.once(channel, handler)
    })
    this.send(message)
    return responsePromise
  }

  /**
   * Posts a message to the given channel.
   * @param channel The channel to use for communication
   * @param message The message to post
   * @param listener The listener to call once the response was received
   */
  private postListener (channel: string, message: Message, listener: ResponseHandler): void {
    const handler: Handler = this.getWrapperHandler(listener)
    this.responseEvents.once(channel, handler)
    this.send(message)
  }

}
