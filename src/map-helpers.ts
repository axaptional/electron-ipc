export interface MapLike<K, V> {
  has (key: K): boolean

  get (key: K): V | undefined

  set (key: K, value: V): this
}

export interface Deletable<T> {
  delete (value: T): boolean
}

export function computeIfAbsent<K, V> (map: MapLike<K, V>, key: K, insert: V): V {
  if (!map.has(key)) {
    map.set(key, insert)
    return insert
  }
  return map.get(key)!
}

export function removeIfPresent<K, V> (map: MapLike<K, Deletable<V>>, key: K, value: V): boolean {
  if (map.has(key)) {
    return map.get(key)!.delete(value)
  }
  return false
}
