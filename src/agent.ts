import Promise from 'any-promise'
import { IpcEvent, IpcService } from './aliases'
import { Cancelable, isCancelable } from './canceler'
import { Channels, CommunicationChannels } from './channels'
import { ResponsivePromise } from './promise'

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
export type Handler = (event: IpcEvent, data: any) => void

/**
 * Represents a proxy handler for responses.
 */
export type ResponseHandler = (response: any) => void

/**
 * Represents a set of options for handling listener arguments and return values.
 */
export interface Options {
  noop: any
}

/**
 * Represents an IPC communicator through which messages can be posted and received.
 */
export abstract class Agent<T extends IpcService> {

  /**
   * The set of options used by all instances by default.
   */
  private static readonly fallbackOptions: Options = {
    noop: true
  }

  /**
   * A listener-handler-pair collection tracking active listeners.
   */
  private handlers: WeakMap<Listener, Handler> = new WeakMap()

  /**
   * Initializes a new Agent for the given Electron IPC service.
   * @param ipcService Either the ipcMain or the ipcRenderer service from Electron
   * @param defaultOptions A set of options to use by default for all message handlers
   */
  protected constructor (protected ipcService: T, protected defaultOptions: Partial<Options> = {}) {}

  /**
   * Overrides the default settings of this IPC communicator instance.
   * Settings not specified in the options argument will retain their values by default.
   * @param options A set of options with settings you want to override
   * @param replace If true, settings not specified in the options argument will be unset
   */
  public configure (options: Partial<Options>, replace: boolean = false): void {
    if (replace) {
      this.defaultOptions = options
      return
    }
    Object.assign(this.defaultOptions, options)
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
  public post (channel: string, data: any, listener: Listener): void

  // TODO: The Promise should be rejected if an uncaught error occurred at the listening endpoint.
  /**
   * Posts a message to the given channel and calls the listener when a response is received.
   * If no response is given, the listener will be called with null as the response instead.
   * If no listener is given, a Promise is returned instead.
   * @param channel The channel to post to
   * @param data The message to post
   * @param listener The listener to call once the response was received
   */
  public post (channel: string, data: any, listener?: Listener): Promise<any> | void {
    const comChannels = Channels.getCommunicationChannels(channel)
    if (typeof listener !== 'undefined') {
      this.postListener(comChannels, data, listener)
    } else {
      return this.postPromise(comChannels, data)
    }
  }

  /**
   * Listens for messages on the given channel and calls the given listener when a message is received.
   * To send a response, simply have the listener function return a value or a Promise.
   * @param channel The channel to listen to
   * @param listener The listener to call for each received message
   * @param options A set of options to override the default options for this call only
   */
  public on (channel: string, listener: Listener, options?: Partial<Options>): void {
    const { requestChannel, responseChannel } = Channels.getCommunicationChannels(channel)
    const params = this.getOptions(options)
    const handler: Handler = (event: IpcEvent, data: any) => {
      const respond: ResponseHandler = (response: any) => this.send(responseChannel, response)
      const responseSource: ResponseSource<any> = listener(data)
      if (responseSource instanceof Promise) {
        responseSource.then(respond)
      } else {
        respond(responseSource)
      }
    }
    this.ipcService.on(requestChannel, handler)
    this.handlers.set(listener, handler)
  }

  /**
   * Listens for a message on the given channel. The Promise resolves once a message was received.
   * Canceling is only possible through the use of an additional library like Bluebird, not with native Promises.
   * To send a response, call respond() on the returned Promise instead of then().
   * @param channel The channel to listen to
   * @param options A set of options to override the default options for this call only
   */
  public once (channel: string, options?: Partial<Options>): ResponsivePromise<any>

  /**
   * Listens for a message on the given channel and calls the given listener when it is received.
   * To send a response, simply have the listener function return a value or a Promise.
   * To stop listening, just call cancel() on the return value of this method.
   * @param channel The channel to listen to
   * @param listener The listener to call once the message was received
   * @param options A set of options to override the default options for this call only
   */
  public once (channel: string, listener: Listener, options?: Partial<Options>): void

  /**
   * Listens for a message on the given channel and calls the given listener when it is received.
   * If no listener is specified, this method returns a Promise that resolves once the message is received instead.
   * To send a response, simply have the listener function return a value or a Promise.
   * If you are using Promises, call respond() on the returned Promise instead of then().
   * To stop listening, just call cancel() on the return value of this method.
   * Canceling a Promise is only possible through the use of an additional library like Bluebird, not natively.
   * @param channel The channel to listen to
   * @param listenerOrOptions The listener to call once the message was received OR an Options object (Promise variant)
   * @param options A set of options to override the default options for this call only (Listener variant)
   */
  public once (channel: string, listenerOrOptions?: Listener | Partial<Options>, options?: Partial<Options>) {
    const comChannels = Channels.getCommunicationChannels(channel)
    if (typeof listenerOrOptions === 'function') {
      return this.onceListener(comChannels, listenerOrOptions, options)
    } else {
      return this.oncePromise(comChannels, listenerOrOptions)
    }
  }

  public removeListener (channel: string, listener: Listener): void {
    if (this.handlers.has(listener)) {
      const requestChannel = Channels.getRequestChannel(channel)
      const handler = this.handlers.get(listener)!
      this.ipcService.removeListener(requestChannel, handler)
    }
  }

  /**
   * Unsubscribes all listeners from all channels.
   */
  public removeAllListeners (): void

  /**
   * Unsubscribes all listeners from the given channel. Omit the channel to unsubscribe from all channels.
   * @param channel The channel to unsubscribe from (or nothing)
   */
  public removeAllListeners (channel?: string): void {
    let channelsToClear: string[] = []
    if (typeof channel !== 'undefined') {
      channelsToClear.push(Channels.getRequestChannel(channel))
    } else {
      channelsToClear = this.ipcService.eventNames().filter(Channels.isRequestChannel)
    }
    for (const channelToClear of channelsToClear) {
      this.ipcService.removeAllListeners(channelToClear)
    }
  }

  /**
   * Sends a message to the other service.
   * @param channel The channel to use for sending the data
   * @param data The data to send
   */
  protected abstract send (channel: string, data: any): void

  /**
   * Returns a set of options according to this instance's default options and the given overrides.
   * @param overrides A set of options with settings that should override default values
   */
  protected getOptions (overrides?: Partial<Options>): Options {
    return Object.assign(Agent.fallbackOptions, this.defaultOptions, overrides)
  }

  /**
   * Posts a message to the given channel.
   * The Promise resolves either when a response is received or when the listening endpoint terminates.
   * @param comChannels The communication channels to use for sending and receiving messages
   * @param data The message to post
   */
  private postPromise (comChannels: CommunicationChannels, data: any): Promise<any> {
    const { requestChannel, responseChannel } = comChannels
    const responsePromise = new Promise((resolve) => {
      const handler: Handler = (event: IpcEvent, response: any) => {
        resolve(response)
      }
      this.ipcService.once(responseChannel, handler)
    })
    this.send(requestChannel, data)
    return responsePromise
  }

  /**
   * Posts a message to the given channel.
   * @param comChannels The communication channels to use for sending and receiving messages
   * @param data The message to post
   * @param listener The listener to call once the response was received
   */
  private postListener (comChannels: CommunicationChannels, data: any, listener: Listener): void {
    const { requestChannel, responseChannel } = comChannels
    const handler: Handler = (event: IpcEvent, response: any) => {
      listener(response)
    }
    this.ipcService.once(responseChannel, handler)
    this.send(requestChannel, data)
  }

  /**
   * Listens for a message. The Promise resolves once a message was received.
   * @param comChannels The communication channels to use for sending and receiving messages
   * @param options A set of options to override the default options for this call only
   */
  private oncePromise (comChannels: CommunicationChannels, options?: Partial<Options>): ResponsivePromise<any> {
    const { requestChannel, responseChannel } = comChannels
    const params = this.getOptions(options)
    const respond: ResponseHandler = (response: any) => this.send(responseChannel, response)
    return new ResponsivePromise((resolve) => {
      const handler: Handler = (event: IpcEvent, data: any) => {
        resolve(data)
      }
      this.ipcService.once(requestChannel, handler)
    }, respond)
  }

  /**
   * Listens for a message and calls the given listener when it is received.
   * @param comChannels The communication channels to use for sending and receiving messages
   * @param listener The listener to call once the message was received
   * @param options A set of options to override the default options for this call only
   */
  private onceListener (comChannels: CommunicationChannels, listener: Listener, options?: Partial<Options>): void {
    const { requestChannel, responseChannel } = comChannels
    const params = this.getOptions(options)
    const handler: Handler = (event: IpcEvent, data: any) => {
      const respond: ResponseHandler = (response: any) => this.send(responseChannel, response)
      const responseSource: ResponseSource<any> = listener(data)
      if (responseSource instanceof Promise) {
        responseSource.then(respond)
      } else {
        respond(responseSource)
      }
      this.handlers.delete(listener)
    }
    this.ipcService.once(requestChannel, handler)
    this.handlers.set(listener, handler)
  }

}
