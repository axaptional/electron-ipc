export function defined<T> (object: T | any): object is T {
  return typeof object !== 'undefined'
}

export function coerceToError (error: any | Error): Error {
  if (error instanceof Error) {
    return error
  } else {
    return new Error(coerceToString(error))
  }
}

export function coerceToString (str: any | string): string {
  if (typeof str === 'string') {
    return str
  } else if (typeof str === 'symbol') {
    const badString = str.toString()
    return badString.slice(7, badString.length - 1)
  } else {
    return str.toString()
  }
}
