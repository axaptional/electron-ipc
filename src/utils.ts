export interface MapLike<K, V> {
  has (key: K): boolean
  get (key: K): V | undefined
  set (key: K, value: V): this
}

export class Utils {

  public static computeIfAbsent<K, V> (map: MapLike<K, V>, key: K, insert: V): V {
    if (!map.has(key)) {
      map.set(key, insert)
      return insert
    }
    return map.get(key)!
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
