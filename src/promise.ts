import Promise from 'any-promise'
import { ResponseListener, ResponseSource } from './agent'

type PromiseExecutor<R> = (resolve: (value?: R | Promise.Thenable<R>) => void, reject: (error?: any) => void) => void

/**
 * @deprecated Use respond() and Promise chaining instead
 */
export class ResponsivePromise<R> extends Promise<R> {
  constructor (executor: PromiseExecutor<R>, private listener: ResponseListener) {
    super(executor)
  }

  public respond<U> (onData: (value: R) => ResponseSource<U>,
                     onRejected?: (error: any) => (Promise.Thenable<U> | U)): Promise<R> {
    const onFulfilled = (value: R) => {
      const responseSource: ResponseSource<U> = onData(value) // Use onFulfilled as regular function
      if (responseSource instanceof Promise) {
        responseSource.then(this.listener)
      } else {
        // @ts-ignore
        this.listener(responseSource)
      }
      return value // Received data will be propagated
    }
    return this.then(onFulfilled, onRejected)
  }
}
