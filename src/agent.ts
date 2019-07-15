import Promise from 'any-promise'
import EventEmitter from 'eventemitter3'
import { IpcEvent, IpcService } from './aliases'
import { Handler, IpcListener, Persistence, TeardownFunction } from './handler'
import { HandlerMap } from './handler-map'
import { AbstractMessage, Message } from './message'
import { OptionsProvider, OptionsStore } from './options'
import { defined } from './utils'

/**
 * Represents a source of a response.
 * The actual response can be resolved synchronously or asynchronously.
 */
export type ResponseSource<T> = Promise.Thenable<T> | T | void

/**
 * Represents a listener function.
 * Responses may be emitted as return values.
 */
export type Listener = (data: any) => ResponseSource<any>

export interface ResponseListener extends Listener {
  (response: any): void
}

/**
 * Represents a set of options for handling listener arguments and return values.
 */
export interface Options {
  /**
   * If true, success listeners take (err, data) arguments and error listeners are disallowed.
   */
  nodeCallbacks: boolean
}

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
  protected readonly requestEvents: EventEmitter<string> = new EventEmitter()

  /**
   * The EventEmitter used for emitting data of incoming responses.
   */
  protected readonly responseEvents: EventEmitter<string> = new EventEmitter()

  private handlers: HandlerMap

  /**
   * Initializes a new Agent for the given Electron IPC service.
   * @param ipcService Either the ipcMain or the ipcRenderer service from Electron
   * @param defaultOptions A set of options to use by default for all message handlers
   */
  protected constructor (protected ipcService: T, defaultOptions?: Partial<Options>) {
    this.options = new OptionsStore(Agent.fallbackOptions, defaultOptions)
    this.handlers = new HandlerMap(this.requestEvents)
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
  public post (channel: string, data: any, listener: ResponseListener): void

  // TODO: The Promise should be rejected if an uncaught error occurred at the listening endpoint.
  /**
   * Posts a message to the given channel and calls the listener when a response is received.
   * If no response is given, the listener will be called with an undefined response instead.
   * If no listener is given, a Promise is returned instead.
   * @param channel The channel to post to
   * @param data The message to post
   * @param listener The listener to call once the response was received
   */
  public post (channel: string, data: any | Error, listener?: ResponseListener): Promise<any> | void {
    if (defined(listener)) {
      this.postListener(channel, data, listener)
    } else {
      return this.postPromise(channel, data)
    }
  }

  /**
   * Sends a response on the given channel.
   * @param channel The channel to respond to
   * @param data The response data
   */
  public respond (channel: string, data: any | Error): void {
    const message = new Message(channel, data, true)
    this.send(message.serialize())
  }

  /**
   * Sends a request on the given channel.
   * @param channel The channel to send the request to
   * @param data The data to send
   */
  public request (channel: string, data: any | Error): void {
    const message = new Message(channel, data)
    this.send(message.serialize())
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
    const handler: IpcListener = this.getResponder(channel, listener, 'on')
    this.requestEvents.on(channel, handler)
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
    const handler: IpcListener = this.getResponder(channel, listener, 'once')
    this.requestEvents.once(channel, handler)
  }

  /**
   * Captures the next message on the given channel. The Promise resolves once a message was received.
   * Canceling is only possible through the use of an additional library like Bluebird, not with native Promises.
   * @param channel The channel to listen to
   * @param options A set of options to override the default options for this call only
   */
  public capture (channel: string, options?: Partial<Options>): Promise<any> {
    const params = this.options.get(options)
    return new Promise((resolve, reject) => {
      const handler: IpcListener = this.getForwarder(channel, resolve, 'once', reject)
      this.requestEvents.once(channel, handler)
    })
  }

  /**
   * Removes all subscriptions of a listener from the given channel.
   * @param channel The channel whose subscriptions tied to the listener should be removed
   * @param listener The listener whose subscriptions tied to the channel should be removed
   */
  public removeListener (channel: string, listener: Listener): void {
    this.handlers.purge(channel, listener)
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
    if (defined(channel)) {
      this.handlers.purge(channel)
    } else {
      this.handlers.clear()
    }
  }

  /**
   * Sends a message to the other service.
   * @param message The message to send
   */
  protected abstract send (message: AbstractMessage): void

  protected getResponder (channel: string, listener: Listener, persistence: Persistence,
                          teardown?: TeardownFunction): IpcListener {
    const handler = new Handler((event: IpcEvent, message: any) => {
      const respond: ResponseListener = (response: any) => this.respond(channel, response)
      const responseSource: ResponseSource<any> = listener(message)
      if (persistence === 'once') this.handlers.delete(channel, listener, handler)
      if (responseSource instanceof Promise) {
        responseSource.then(respond)
      } else {
        respond(responseSource)
      }
    }, persistence, teardown)
    if (persistence !== 'never') this.handlers.add(channel, listener, handler)
    return handler.run
  }

  protected getForwarder (channel: string, listener: ResponseListener, persistence: Persistence,
                          teardown?: TeardownFunction): IpcListener {
    const handler = new Handler((event: IpcEvent, response: any) => {
      listener(response)
      if (persistence === 'once') this.handlers.delete(channel, listener, handler)
    }, persistence, teardown)
    if (persistence !== 'never') this.handlers.add(channel, listener, handler)
    return handler.run
  }

  /**
   * Listener for incoming messages. Redistributes message data to specialized EventEmitters.
   * @param ipcEvent The Electron IPC event
   * @param message The message that was received
   */
  private onDataReceived (ipcEvent: IpcEvent, message: AbstractMessage) {
    const { data, channel, isResponse } = Message.deserialize(message)
    const emitter: EventEmitter = (isResponse) ? this.responseEvents : this.requestEvents
    emitter.emit(channel, data)
  }

  /**
   * Posts a message to the given channel.
   * The Promise resolves either when a response is received or when the listening endpoint terminates.
   * @param channel The channel to use for communication
   * @param data The message data to post
   */
  private postPromise (channel: string, data: any | Error): Promise<any> {
    const responsePromise = new Promise((resolve, reject) => {
      const handler: IpcListener = this.getForwarder(channel, resolve, 'never', reject)
      this.responseEvents.once(channel, handler)
    })
    this.request(channel, data)
    return responsePromise
  }

  /**
   * Posts a message to the given channel.
   * @param channel The channel to use for communication
   * @param data The message data to post
   * @param listener The listener to call once the response was received
   */
  private postListener (channel: string, data: any | Error, listener: ResponseListener): void {
    const handler: IpcListener = this.getForwarder(channel, listener, 'never')
    this.responseEvents.once(channel, handler)
    this.request(channel, data)
  }

}
