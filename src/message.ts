export interface AbstractMessage {
  data?: any,
  channel: string,
  isResponse: boolean,
  isError: boolean
}

export class Message implements AbstractMessage {

  public isError: boolean

  public constructor (public channel: string, public data: any | Error, public isResponse: boolean = false) {
    this.isError = data instanceof Error
  }

  public static deserialize (message: AbstractMessage): Message {
    const result = new Message(message.channel, message.data, message.isResponse)
    if (message.isError) {
      result.data = new Error(message.data.message)
      result.data.name = message.data.name
    }
    return result
  }

  public serialize (): AbstractMessage {
    const serializedMessage: any = JSON.stringify(this)
    return serializedMessage as AbstractMessage
  }

}
