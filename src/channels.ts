/**
 * Represents a pair of communication channels for requests and responses.
 */
export interface CommunicationChannels {
  /**
   * The channel to send requests to.
   */
  requestChannel: string;
  /**
   * The channel to receive responses from.
   */
  responseChannel: string;
}

/**
 * Represents a service for generating channel names.
 */
export class Channels {
  /**
   * Returns the channel to send requests to for the given origin.
   * @param origin The origin/Electron channel name
   */
  public static getRequestChannel(origin: string): string {
    return `${origin}-request`;
  }

  /**
   * Returns whether the given channel name belongs to a request channel.
   * @param channel
   */
  public static isRequestChannel(channel: string): boolean {
    return channel.endsWith('-request');
  }

  /**
   * Returns the channel to receive responses from for the given origin.
   * @param origin The origin/Electron channel name
   */
  public static getResponseChannel(origin: string): string {
    return `${origin}-response`;
  }

  /**
   * Returns a pair of communication channels for the given origin.
   * @param origin The origin/Electron channel name
   */
  public static getCommunicationChannels(origin: string): CommunicationChannels {
    return {
      requestChannel: this.getRequestChannel(origin),
      responseChannel: this.getResponseChannel(origin),
    };
  }
}
