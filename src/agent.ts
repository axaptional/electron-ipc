import { Channels, CommunicationChannels } from './channels';
import { IpcEvent, IpcService } from './aliases';
import Promise from 'any-promise';

export interface Cancelable {
  cancel(): void;
}

/**
 * Represents a helper to unsubscribe a listener function from a channel.
 */
export class Canceler implements Cancelable {
  /**
   * Initializes a new Canceler.
   * @param ipcService The IPC service to use for unsubscribing
   * @param channel The channel to unsubscribe from
   * @param handler The listener to unsubscribe
   */
  constructor(private ipcService: IpcService, public channel: string, private handler: Function) {}

  /**
   * Unsubscribes the listener, meaning it will no longer be called when a message is received.
   */
  public cancel(): void {
    this.ipcService.removeListener(this.channel, this.handler);
  }
}

/**
 * Represents a set of options for handling listener arguments and return values.
 */
export interface ListenerOptions {
  /**
   * Whether the listener should be called with spread arguments (true) or an arguments array (false, default).
   */
  spread: boolean;
}

// TODO: Replies
/**
 * Represents an IPC communicator through which messages can be posted and received.
 */
export abstract class Agent<T extends IpcService> {
  /**
   * Initializes a new Agent for the given Electron IPC service.
   * @param ipcService Either the ipcMain or the ipcRenderer service from Electron
   */
  protected constructor(protected ipcService: T) {}

  /**
   * Sends a message to the other service.
   * @param requestChannel The channel to use for sending the request
   * @param data The request data
   */
  protected abstract send(requestChannel: string, ...data: any[]): void;

  /**
   * Responds to a given event from the other process.
   * @param event The event to respond to
   * @param responseChannel The channel to use for sending the response
   * @param data The response data
   */
  protected abstract respond(event: IpcEvent, responseChannel: string, ...data: any[]): void;

  // TODO: The Promise should be rejected if an uncaught error occurred at the listening endpoint.
  /**
   * Posts a message to the given channel.
   * The Promise resolves either when a response is received or when the listening endpoint terminates.
   * @param channel The channel to post to
   * @param data The message to post
   */
  public post(channel: string, ...data: any[]): Promise<any> {
    const { requestChannel, responseChannel } = Channels.getCommunicationChannels(channel);
    const response = new Promise((resolve, reject) => {
      const handler = (event: IpcEvent, ...args: any[]) => {
        resolve(args);
      };
      this.ipcService.once(responseChannel, handler);
    });
    this.send(requestChannel, ...data);
    return response;
  }

  /**
   * Listens for messages on the given channel and calls the given listener when a message is received.
   * To send a response, simply have the listener function return a value or a Promise.
   * To stop listening, just call cancel() on the return value of this method.
   * @param channel The channel to listen to
   * @param listener The listener to call for each received message
   * @param options Options specifying how to treat the listener function
   */
  public on(channel: string, listener: Function, options: ListenerOptions): Canceler {
    const { requestChannel, responseChannel } = Channels.getCommunicationChannels(channel);
    const params = Object.assign(
      {
        spread: false,
      },
      options,
    );
    const handler = (event: IpcEvent, ...args: any[]) => {
      const respond = (...data: any[]) => this.respond(event, responseChannel, ...data);
      const response: any = params.spread ? listener(...args) : listener(args);
      if (response instanceof Promise) {
        response.then(respond);
      } else {
        respond(response);
      }
    };
    this.ipcService.on(requestChannel, handler);
    return new Canceler(this.ipcService, requestChannel, handler);
  }

  /**
   * Listens for a message on the given channel. The Promise resolves once a message was received.
   * Canceling is only possible through the use of an additional library like Bluebird, not with native Promises.
   * Responses using Promises are currently not supported. If you need to respond, use a listener instead.
   * @param channel The channel to listen to
   */
  public once(channel: string): Promise<any>;
  /**
   * Listens for a message on the given channel and calls the given listener when it is received.
   * To send a response, simply have the listener function return a value or a Promise.
   * To stop listening, just call cancel() on the return value of this method.
   * @param channel The channel to listen to
   * @param listener The listener to call once the message was received
   * @param options Options specifying how to treat the listener function
   */
  public once(channel: string, listener: Function, options?: ListenerOptions): Canceler;
  /**
   * Listens for a message on the given channel and calls the given listener when it is received.
   * If no listener is specified, this method returns a Promise that resolves once the message is received instead.
   * To send a response, simply have the listener function return a value or a Promise.
   * To stop listening, just call cancel() on the return value of this method.
   * Canceling a Promise is only possible through the use of an additional library like Bluebird, not natively.
   * Responses using Promises are currently not supported. If you need to respond, use a listener instead.
   * @param channel The channel to listen to
   * @param listener The listener to call once the message was received (or nothing to use Promises instead)
   * @param options Options specifying how to treat the listener function (ignored when using Promises)
   */
  public once(channel: string, listener?: Function, options?: ListenerOptions) {
    const comChannels = Channels.getCommunicationChannels(channel);
    if (typeof listener === 'undefined') {
      return this.oncePromise(comChannels);
    } else {
      return this.onceListener(comChannels, listener, options);
    }
  }

  /**
   * Listens for a message. The Promise resolves once a message was received.
   * @param comChannels The communication channels to use for sending and receiving messages
   */
  private oncePromise(comChannels: CommunicationChannels): Promise<any> {
    const { requestChannel, responseChannel } = comChannels;
    return new Promise((resolve, reject) => {
      const handler = (event: IpcEvent, ...args: any[]) => {
        resolve(args);
        const response: any = undefined;
        this.respond(event, responseChannel, response);
      };
      this.ipcService.once(requestChannel, handler);
    });
  }

  /**
   * Listens for a message and calls the given listener when it is received.
   * @param comChannels The communication channels to use for sending and receiving messages
   * @param listener The listener to call once the message was received
   * @param options Options specifying how to treat the listener function
   */
  private onceListener(comChannels: CommunicationChannels, listener: Function, options?: ListenerOptions): Canceler {
    const { requestChannel, responseChannel } = comChannels;
    const params = Object.assign(
      {
        spread: false,
      },
      options,
    );
    const handler = (event: IpcEvent, ...args: any[]) => {
      const respond = (...data: any[]) => this.respond(event, responseChannel, ...data);
      const response: any = params.spread ? listener(...args) : listener(args);
      if (response instanceof Promise) {
        response.then(respond);
      } else {
        respond(response);
      }
    };
    this.ipcService.once(requestChannel, handler);
    return new Canceler(this.ipcService, requestChannel, handler);
  }

  // TODO: Request Promises should be canceled/rejected when removeAllListeners() is called.
  /**
   * Unsubscribes all listeners from all channels.
   */
  public removeAllListeners(): void;
  /**
   * Unsubscribes all listeners from the given channel.
   * @param channel The channel to unsubscribe from
   */
  public removeAllListeners(channel: string): void;
  /**
   * Unsubscribes all listeners from the given channel. Omit the channel to unsubscribe from all channels.
   * @param channel The channel to unsubscribe from (or nothing)
   */
  public removeAllListeners(channel?: string): void {
    const channels = [];
    if (typeof channel !== 'undefined') {
      channels.push(Channels.getRequestChannel(channel));
    } else {
      channels.push(...this.ipcService.eventNames().filter(Channels.isRequestChannel));
    }
    for (let channel of channels) {
      this.ipcService.removeAllListeners(channel);
    }
  }
}
