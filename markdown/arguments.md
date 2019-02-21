# Argument behavior in detail

Refer to the following table to see which input arguments are transformed to
which output arguments.

Keep in mind that `{ args: 'as-is' }` is only available for listeners.

| Options             | `()`   | `(1)`   | `(1, 2)`   | `([1])`   | `([1, 2])`   | `([1], 2)`   |
|---------------------|--------|---------|------------|-----------|--------------|--------------|
| `{}`                | `()`   | `(1)`   | `([1, 2])` | `([1])`   | `([1, 2])`   | `([[1], 2])` |
| `{ args: 'array' }` | `([])` | `([1])` | `([1, 2])` | `([[1]])` | `([[1, 2]])` | `([[1], 2])` |
| `{ args: 'as-is' }` | `()`   | `(1)`   | `(1, 2)`   | `([1])`   | `([1, 2])`   | `([1], 2)`   |

## Default behavior

By default, arguments will be atomized due to Promises only being able to
resolve to a single object.
This means that any `...args: any[]` will be adjusted according to the
following rules before being passed to listeners or Promise handlers:

- `post() -> ()`  
  If no data is passed, the argument is `null` ("no arguments")

- `post(1) -> (1)`  
  If a single value is passed, the argument is that value

- `post(1, 2) -> ([1, 2])`  
  If two or more values are passed, the argument is an array of these values

Due to this behavior, calling `post` with `post(1, 2)` actually yields the same
result as calling `post` with `post([1, 2])`, since the array is treated as a
single value that does not need to be encapsulated.

This behavior applies to messages sent with `post` and received by `on`/`once`.

## Objects

Since objects are treated as single values,
you can circumvent atomization issues by wrapping your arguments in an object.

```js
client.post('channel', { myValue: 1, myArray: [2, 3] });
```

Still, keep in mind that the passed object MUST be serializable,
since Electron's IPC modules automatically convert passed arguments to JSON.

This means that values such as functions and classes cannot be passed.
Support for `Date` object serialization is included with this package.

Furthermore, be aware that objects received by responses via `post` or
through channels via `on` or `once` will still have all class prototype
information stripped.

## Disable atomization

If you would like to change this behavior,
you can pass `{ args: 'array' }` as options.

If atomization is turned off, `post(1, 2)` will yield `[1, 2]` as an argument
while `post([1, 2])` will yield `[[1, 2]]`.
This is especially useful when calling `post` with spread arguments,
e.g. `post(...myData)`.

## Using rest parameters (listener only)

By default, argument behavior is normalized so that there is no difference
between the arguments listeners and Promise handlers receive.
Since listeners have the advantage of being able to accept multiple arguments,
you can pass `{ args: 'as-is' }` as options to receive arguments as-is.

## Links

[Back to README.md](../README.md)
