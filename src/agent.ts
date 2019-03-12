import Promise from 'any-promise'
import { IpcEvent, IpcService } from './aliases'
import { Cancelable, isCancelable } from './canceler'
import { Channels, CommunicationChannels } from './channels'

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
  noop: any
}

export interface Message {
  data: any,
  response: boolean,
  error: boolean,
  isUndefined: boolean
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
  public post (channel: string, data: any, listener: ResponseHandler): void

  // TODO: The Promise should be rejected if an uncaught error occurred at the listening endpoint.
  /**
   * Posts a message to the given channel and calls the listener when a response is received.
   * If no response is given, the listener will be called with null as the response instead.
   * If no listener is given, a Promise is returned instead.
   * @param channel The channel to post to
   * @param data The message to post
   * @param listener The listener to call once the response was received
   */
  public post (channel: string, data: any, listener?: ResponseHandler): Promise<any> | void {
    const comChannels = Channels.getCommunicationChannels(channel)
    const message = this.constructMessage(data)
    if (typeof listener !== 'undefined') {
      this.postListener(comChannels, message, listener)
    } else {
      return this.postPromise(comChannels, message)
    }
  }

  public respond (channel: string, data: any): void {
    const responseChannel = Channels.getResponseChannel(channel)
    const message: Message = this.constructMessage(data, true)
    this.send(responseChannel, message)
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
    const handler: Handler = this.getHandler(responseChannel, listener)
    this.ipcService.on(requestChannel, handler)
    this.handlers.set(listener, handler)
  }

  /**
   * Listens for a message on the given channel and calls the given listener when it is received.
   * To send a response, simply have the listener function return a value or a Promise.
   * To stop listening, just call cancel() on the return value of this method.
   * @param channel The channel to listen to
   * @param listener The listener to call once the message was received
   * @param options A set of options to override the default options for this call only
   */
  public once (channel: string, listener: Listener, options?: Partial<Options>): void {
    const { requestChannel, responseChannel } = Channels.getCommunicationChannels(channel)
    const params = this.getOptions(options)
    const handler: Handler = this.getHandler(responseChannel, listener, () => {
      this.handlers.delete(listener)
    })
    this.ipcService.once(requestChannel, handler)
    this.handlers.set(listener, handler)
  }

  /**
   * Captures the next message on the given channel. The Promise resolves once a message was received.
   * Canceling is only possible through the use of an additional library like Bluebird, not with native Promises.
   * @param channel The channel to listen to
   * @param options A set of options to override the default options for this call only
   */
  public capture (channel: string, options?: Partial<Options>): Promise<any> {
    const requestChannel = Channels.getRequestChannel(channel)
    const params = this.getOptions(options)
    return new Promise((resolve) => {
      const handler: Handler = this.getWrapperHandler(resolve)
      this.ipcService.once(requestChannel, handler)
    })
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

  protected constructMessage (data: any | Error, response: boolean = false): Message {
    const error = data instanceof Error
    const isNull = data === null
    return { data, error, isUndefined: isNull, response }
  }

  protected deconstructMessage (message: Message): any {
    let data = message.data
    if (message.isUndefined) {
      data = void 0
    } else if (message.error) {
      data = new Error(message.data.message)
      data.name = message.data.name
    }
    data.$response = message.response
    return message
  }

  /**
   * Sends a message to the other service.
   * @param channel The channel to use for sending the data
   * @param message The message to send
   */
  protected abstract send (channel: string, message: Message): void

  /**
   * Returns a set of options according to this instance's default options and the given overrides.
   * @param overrides A set of options with settings that should override default values
   */
  protected getOptions (overrides?: Partial<Options>): Options {
    return Object.assign(Agent.fallbackOptions, this.defaultOptions, overrides)
  }

  protected getHandler (responseChannel: string, listener: Listener, teardown?: Task): Handler {
    return (event: IpcEvent, message: Message) => {
      const respond: ResponseHandler = (response: any) => this.send(responseChannel, response)
      const data = this.deconstructMessage(message)
      const responseSource: ResponseSource<any> = listener(data)
      if (responseSource instanceof Promise) {
        responseSource.then(respond)
      } else {
        respond(responseSource)
      }
      if (typeof teardown !== 'undefined') {
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
   * Posts a message to the given channel.
   * The Promise resolves either when a response is received or when the listening endpoint terminates.
   * @param comChannels The communication channels to use for sending and receiving messages
   * @param message The message to post
   */
  private postPromise (comChannels: CommunicationChannels, message: Message): Promise<any> {
    const { requestChannel, responseChannel } = comChannels
    const responsePromise = new Promise((resolve) => {
      const handler: Handler = this.getWrapperHandler(resolve)
      this.ipcService.once(responseChannel, handler)
    })
    this.send(requestChannel, message)
    return responsePromise
  }

  /**
   * Posts a message to the given channel.
   * @param comChannels The communication channels to use for sending and receiving messages
   * @param message The message to post
   * @param listener The listener to call once the response was received
   */
  private postListener (comChannels: CommunicationChannels, message: Message, listener: ResponseHandler): void {
    const { requestChannel, responseChannel } = comChannels
    const handler: Handler = this.getWrapperHandler(listener)
    this.ipcService.once(responseChannel, handler)
    this.send(requestChannel, message)
  }

}
