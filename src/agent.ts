import Promise from 'any-promise'
import { IpcEvent, IpcService } from './aliases'
import { Canceler } from './canceler'
import { Channels, CommunicationChannels } from './channels'

/**
 * Represents a source of a response.
 * The actual response can be resolved synchronously or asynchronously.
 */
export type ResponseSource<T> = Promise.Thenable<T> | T

/**
 * Represents an arguments transformation method.
 * 'atomize' reduces the arguments to one object only if necessary.
 * 'array' always keeps arguments wrapped in an array.
 * 'as-is' spreads the arguments array for calls.
 */
export type ArgumentsStyle = 'atomize' | 'array' | 'as-is'

/**
 * Represents a listener function.
 * Argument behavior depends on the options of the calling instance.
 * Responses may be emitted as return values.
 */
export type Listener = (...data: any[]) => ResponseSource<any> | void

/**
 * Represents a proxy handler for responses.
 */
export type ResponseHandler = (response: any) => void

/**
 * Represents a set of options for handling listener arguments and return values.
 */
export interface Options {
  /**
   * Determines how argument transformation is handled when being passed to a listener or Promise.
   */
  args: ArgumentsStyle
}

// TODO: Replies with Promises
/**
 * Represents an IPC communicator through which messages can be posted and received.
 */
export abstract class Agent<T extends IpcService> {
  /**
   * The set of options used by all instances by default.
   */
  private static readonly fallbackOptions: Options = {
    args: 'atomize'
  }

  /**
   * Initializes a new Agent for the given Electron IPC service.
   * @param ipcService Either the ipcMain or the ipcRenderer service from Electron
   * @param defaultOptions A set of options to use by default for all message handlers
   */
  protected constructor (protected ipcService: T, protected defaultOptions: Partial<Options> = {}) {}

  /**
   * Returns an atomized value for the given array.
   * If the array has length 0, the return value will be undefined.
   * If the array has length 1, the return value will be the first and only array item.
   * If the array has a length of 2 or above, the return value will be the input array.
   * @param args The arguments to atomize
   */
  protected static atomize<T> (args: T[]): T | T[] {
    return args.length > 1 ? args : args[0]
  }

  /**
   * Calls the given listener with the given arguments transformed according to the given style.
   * @param listener The function to call
   * @param args The arguments to pass
   * @param style A string specifying how to pass the arguments
   */
  protected static applyWithStyle (listener: Listener, args: any[], style: ArgumentsStyle): any {
    switch (style) {
      default:
      case 'atomize':
        return listener(Agent.atomize(args))
      case 'array':
        return listener(args)
      case 'as-is':
        return listener(...args)
    }
  }

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

  // TODO: The Promise should be rejected if an uncaught error occurred at the listening endpoint.
  public post (channel: string, ...data: any[]): Promise<any>
  public post (channel: string, listener: Listener, ...data: any[]): Canceler
  /**
   * Posts a message to the given channel.
   * The Promise resolves either when a response is received or when the listening endpoint terminates.
   * @param channel The channel to post to
   * @param data The message to post
   */
  public post (channel: string, ...data: any[]): Promise<any> | Canceler {
    const comChannels = Channels.getCommunicationChannels(channel)
    if (typeof data[0] === 'function') {
      const listener: Listener = data.splice(0, 1)[0]
      return this.postListener(comChannels, listener, data)
    } else {
      return this.postPromise(comChannels, data)
    }
  }

  /**
   * Listens for messages on the given channel and calls the given listener when a message is received.
   * To send a response, simply have the listener function return a value or a Promise.
   * To stop listening, just call cancel() on the return value of this method.
   * @param channel The channel to listen to
   * @param listener The listener to call for each received message
   * @param options A set of options to override the default options for this call only
   */
  public on (channel: string, listener: Listener, options?: Partial<Options>): Canceler {
    const { requestChannel, responseChannel } = Channels.getCommunicationChannels(channel)
    const params = this.getOptions(options)
    const handler = (event: IpcEvent, ...args: any[]) => {
      const respond: ResponseHandler = (response: any) => this.send(responseChannel, response)
      const responseSource: ResponseSource<any> = Agent.applyWithStyle(listener, args, params.args)
      if (responseSource instanceof Promise) {
        responseSource.then(respond)
      } else {
        respond(responseSource)
      }
    }
    this.ipcService.on(requestChannel, handler)
    return new Canceler(this.ipcService, requestChannel, handler)
  }

  /**
   * Listens for a message on the given channel. The Promise resolves once a message was received.
   * Canceling is only possible through the use of an additional library like Bluebird, not with native Promises.
   * Responses using Promises are currently not supported. If you need to respond, use a listener instead.
   * @param channel The channel to listen to
   * @param options A set of options to override the default options for this call only
   */
  public once (channel: string, options?: Partial<Options>): Promise<any>
  /**
   * Listens for a message on the given channel and calls the given listener when it is received.
   * To send a response, simply have the listener function return a value or a Promise.
   * To stop listening, just call cancel() on the return value of this method.
   * @param channel The channel to listen to
   * @param listener The listener to call once the message was received
   * @param options A set of options to override the default options for this call only
   */
  public once (channel: string, listener: Listener, options?: Partial<Options>): Canceler
  /**
   * Listens for a message on the given channel and calls the given listener when it is received.
   * If no listener is specified, this method returns a Promise that resolves once the message is received instead.
   * To send a response, simply have the listener function return a value or a Promise.
   * To stop listening, just call cancel() on the return value of this method.
   * Canceling a Promise is only possible through the use of an additional library like Bluebird, not natively.
   * Responses using Promises are currently not supported. If you need to respond, use a listener instead.
   * @param channel The channel to listen to
   * @param listenerOrOptions The listener to call once the message was received or an Options object
   * @param options A set of options to override the default options for this call only
   */
  public once (channel: string, listenerOrOptions?: Listener | Partial<Options>, options?: Partial<Options>) {
    const comChannels = Channels.getCommunicationChannels(channel)
    if (typeof listenerOrOptions === 'function') {
      return this.onceListener(comChannels, listenerOrOptions, options)
    } else {
      return this.oncePromise(comChannels, listenerOrOptions)
    }
  }

  // TODO: Request Promises should be canceled/rejected when removeAllListeners() is called.
  /**
   * Unsubscribes all listeners from all channels.
   */
  public removeAllListeners (): void
  /**
   * Unsubscribes all listeners from the given channel. Omit the channel to unsubscribe from all channels.
   * @param channel The channel to unsubscribe from (or nothing)
   */
  public removeAllListeners (channel?: string): void {
    const channelsToRemove = []
    if (typeof channel !== 'undefined') {
      channelsToRemove.push(Channels.getRequestChannel(channel))
    } else {
      channelsToRemove.push(...this.ipcService.eventNames().filter(Channels.isRequestChannel))
    }
    for (const channelToRemove of channelsToRemove) {
      this.ipcService.removeAllListeners(channelToRemove)
    }
  }

  /**
   * Sends a message to the other service.
   * @param channel The channel to use for sending the request
   * @param data The request data
   */
  protected abstract send (channel: string, ...data: any[]): void

  /**
   * Returns a set of options according to this instance's default options and the given overrides.
   * @param overrides A set of options with settings that should override default values
   */
  protected getOptions (overrides?: Partial<Options>): Options {
    return Object.assign(Agent.fallbackOptions, this.defaultOptions, overrides)
  }

  private postPromise (comChannels: CommunicationChannels, data: any[]): Promise<any> {
    const { requestChannel, responseChannel } = comChannels
    const responsePromise = new Promise((resolve) => {
      const handler = (event: IpcEvent, response: any) => {
        resolve(response)
      }
      this.ipcService.once(responseChannel, handler)
    })
    this.send(requestChannel, ...data)
    return responsePromise
  }

  private postListener (comChannels: CommunicationChannels, listener: Listener, data: any[]): Canceler {
    const { requestChannel, responseChannel } = comChannels
    const handler = (event: IpcEvent, response: any) => {
      listener(response)
    }
    this.ipcService.once(responseChannel, handler)
    this.send(requestChannel, ...data)
    return new Canceler(this.ipcService, responseChannel, handler)
  }

  /**
   * Listens for a message. The Promise resolves once a message was received.
   * @param comChannels The communication channels to use for sending and receiving messages
   * @param options A set of options to override the default options for this call only
   */
  private oncePromise (comChannels: CommunicationChannels, options?: Partial<Options>): Promise<any> {
    const { requestChannel, responseChannel } = comChannels
    const params = this.getOptions(options)
    return new Promise((resolve) => {
      const handler = (event: IpcEvent, ...args: any[]) => {
        Agent.applyWithStyle(resolve, args, params.args)
        const response: ResponseSource<any> = undefined
        this.send(responseChannel, response)
      }
      this.ipcService.once(requestChannel, handler)
    })
  }

  /**
   * Listens for a message and calls the given listener when it is received.
   * @param comChannels The communication channels to use for sending and receiving messages
   * @param listener The listener to call once the message was received
   * @param options A set of options to override the default options for this call only
   */
  private onceListener (comChannels: CommunicationChannels, listener: Listener, options?: Partial<Options>): Canceler {
    const { requestChannel, responseChannel } = comChannels
    const params = this.getOptions(options)
    const handler = (event: IpcEvent, ...args: any[]) => {
      const respond: ResponseHandler = (response: any) => this.send(responseChannel, response)
      const responseSource: ResponseSource<any> = Agent.applyWithStyle(listener, args, params.args)
      if (responseSource instanceof Promise) {
        responseSource.then(respond)
      } else {
        respond(responseSource)
      }
    }
    this.ipcService.once(requestChannel, handler)
    return new Canceler(this.ipcService, requestChannel, handler)
  }
}
