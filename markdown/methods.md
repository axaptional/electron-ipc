# Methods

Here are short explanations on most visible methods.

## Client / Server

Since the APIs for `Client` and `Server` are symmetric,
all listed methods are available in both classes.

Be aware that the signature for listeners may vary depending
on your argument options.
For more information, see [Argument behavior in detail](arguments.md).

### post(channel, options?, ...data): Promise

channel: `string`  
options: `Options`  
data: `any[]`

Posts a message with the given data on the given channel.

The Promise is resolved with the response (`any`) from the other side.
For synchronous behavior, use `await` to wait for the Promise to resolve.

Please be aware that the returned Promise will not be resolved unless a handler
is attached on the other side with `on` or `once`.
If a listener _is_ attached on the other side, the Promise will always resolve,
even if no response is returned (the response will simply be `null`).

To settle the promise and not wait for a response, cancel it.
For more information on Promise canceling,
see [Cancelable Promises](../README.md#cancelable-promises).

### post(channel, listener, options?, ...data): Canceler

channel: `string`  
listener: `(response: any) => void`  
options: `Options` (Optional)  
data: `any[]` (Optional)

Posts a message like the above but uses a listener instead.

Unlike `post(...): Promise`, the listener will simply not be called if
no handler is attached on the other side with `on` or `once`.

To stop the listener, call `cancel()` on the return value of this method.

### once(channel, options?): Promise

channel: `string`  
options: `Options` (Optional)

Listens for messages on the given channel until a message is received.
All subsequent messages on the channel will not be picked up.

The Promise is resolved as soon as a message is received.

_Responding from a Promise is currently not supported._
_Use [`once(...): Canceler`](#oncechannel-listener-options-canceler)
instead if you need to respond._

### once(channel, listener, options?): Canceler

channel: `string`  
listener: `(data: any) => void|any|Promise<any>`  
options: `Options` (Optional)

Listens for a message like the above but uses a listener instead.

To send a response, have the listener return a value or a Promise.
If a Promise is returned, the resolved value will be used for the response.

To stop the listener, call `cancel()` on the return value of this method.

### on(channel, listener, options?): Canceler

channel: `string`  
listener: `(data: any) => void|any|Promise<any>`  
options: `Options` (Optional)

Listens for a message on the given channel.
Unlike `once`, `on` will keep listening after the first message is received.

To send a response, have the listener return a value or a Promise.
If a Promise is returned, the resolved value will be used for the response.

To stop listening, call `cancel()` on the return value of this method.

**Note**:
Since Promises can only resolve _once_, `on` has no Promise counterpart.

### removeAllListeners(): void

Removes all message listeners from all channels.
This method will also try to cancel any pending Promises if
canceling is available.

**Note**:
This method only affects message listeners attached via `on` or `once`.
Response listeners attached via `post` will not be removed or canceled.

### removeAllListeners(channel): void

channel: `string`

Removes all message listeners from the given channel.

Otherwise, this method acts just like the one above.

## Links

[Back to README.md](../README.md)
