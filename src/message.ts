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

  public static deserialize ({ channel, data, isResponse, isError }: AbstractMessage): Message {
    const result = new Message(channel, data, isResponse)
    if (isError) {
      result.data = new Error(data.message)
      result.data.name = data.name
    }
    return result
  }

  public serialize (): AbstractMessage {
    const serializedMessage: any = JSON.stringify(this)
    return serializedMessage as AbstractMessage
  }

}
