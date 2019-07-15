export interface MapLike<K, V> {
  has (key: K): boolean
  get (key: K): V | undefined
  set (key: K, value: V): this
}

export interface Deletable<T> {
  delete (value: T): boolean
}

export function defined<T> (object: T | any): object is T {
  return typeof object !== 'undefined'
}

export class Utils {

  public static coerceToError (error: any | Error): Error {
    if (error instanceof Error) {
      return error
    } else {
      return new Error(Utils.coerceToString(error))
    }
  }

  public static coerceToString (str: any | string): string {
    if (typeof str === 'string') {
      return str
    } else if (typeof str === 'symbol') {
      const badString = str.toString()
      return badString.slice(7, badString.length - 1)
    } else {
      return str.toString()
    }
  }

  public static computeIfAbsent<K, V> (map: MapLike<K, V>, key: K, insert: V): V {
    if (!map.has(key)) {
      map.set(key, insert)
      return insert
    }
    return map.get(key)!
  }

  public static removeIfPresent<K, V> (map: MapLike<K, Deletable<V>>, key: K, value: V): boolean {
    if (map.has(key)) {
      return map.get(key)!.delete(value)
    }
    return false
  }

  public static removeFromArray<T> (array: T[], item: T): boolean {
    for (let i = 0; i < array.length; i++) {
      if (array[i] === item) {
        array.splice(i, 1)
        return true
      }
    }
    return false
  }

}
