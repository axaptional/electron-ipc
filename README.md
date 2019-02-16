# electron-ipc

[![MIT license](https://img.shields.io/github/license/axaptional/electron-ipc.svg)][LICENSE]
[![Issues](https://img.shields.io/github/issues/axaptional/electron-ipc.svg)][ISSUES]
[![NPM Version](https://img.shields.io/npm/v/@axaptional/electron-ipc.svg)][NPM]
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)][STANDARD]
[![Documentation Coverage](docs/images/coverage-badge-documentation.svg)][PAGES]

An easy-to-use symmetric wrapper around Electron's IPC API

**Note:**
This package is still a **work in progress** and should not be used in any
projects yet, let alone any production environments.

## Features

This package allows you to use a normalized, symmetric API for IPC.
This means that both the client and server APIs can be used as if they were
exactly the same.

The following means of asynchronous communication are currently supported:

- listeners / callbacks
- native Promises (ES2015+)
- custom Promises (like `bluebird`)

## Installation

Use `npm` to install [`@axaptional/electron-ipc`][NPM]:

```bash
$ npm install @axaptional/electron-ipc
```

### Extensions

#### Cancelable Promises

If you want to use cancelable Promises, install a Promise library like
[`bluebird`][bluebird] supporting this feature,
then register your Promise constructor with
[`any-promise`][any-promise] like this:

```js
require('any-promise/register/bluebird');
// or
import 'any-promise/register/bluebird';
```

You will need to register your custom Promise constructor in both the main and
the renderer process in order to use canceling in both.
`any-promise` is automatically installed since it is a dependency of this
package.

#### Observables

_The extension package for Observable support is not available yet._

If you want to use Observables, install
[`@axaptional/electron-ipc-rx`][electron-ipc-rx].
This package will add `$`-postfix counterparts to most methods,
e.g. `post$(...)`.
Keep in mind that you will need to adjust your imports when switching from
electron-ipc.

## Usage

### Post messages and receive responses

Probably one of the most prominent use cases is that you want to initiate a
main process function from the renderer process and do something with the
result of that function in the renderer process.

**Renderer Process**

```js
import { Client } from '@axaptional/electron-ipc';

const client = new Client();

client.post('message', 'this').then(response => {
  console.log(response); // Prints "And here is the reply to this"
});
```

**Main Process**

```js
import { BrowserWindow } from 'electron';
import { Server } from '@axaptional/electron-ipc';

const myWindow = new BrowserWindow();
// ...

const server = new Server(myWindow.webContents);

server.on('message', message => {
  return `And here is the reply to ${message}`;
});
```

### Posting from main and responding from renderer

If you want to use IPC in the other direction, _you can_:

The APIs for `Client` and `Server` are exactly the same.
For example, you can also `post` a message from the main process to the
renderer process, then use `on`/`once` to respond back.
In the above code, you could just swap all lines after the
`Client` and `Server` initializations to do just that.

### Argument behavior

By default, arguments will be atomized, making them fit into a single object.
This transformation is made because Promises can only resolve to _one_ value.

This behavior applies to messages sent with `post` and received by `on`/`once`.

Refer to the following table to see which input arguments are transformed to
which output arguments with the respective `args` option.
Keep in mind that `{ args: 'as-is' }` is only available for listeners.

| Options             | `()`   | `(1)`   | `(1, 2)`   | `([1])`   | `([1, 2])`   | `([1], 2)`   |
|---------------------|--------|---------|------------|-----------|--------------|--------------|
| `{}`                | `()`   | `(1)`   | `([1, 2])` | `([1])`   | `([1, 2])`   | `([[1], 2])` |
| `{ args: 'array' }` | `([])` | `([1])` | `([1, 2])` | `([[1]])` | `([[1, 2]])` | `([[1], 2])` |
| `{ args: 'as-is' }` | `()`   | `(1)`   | `(1, 2)`   | `([1])`   | `([1, 2])`   | `([1], 2)`   |

For more detailed information, see [Argument behavior in detail][arguments].

### Methods

For short explanations on available methods, see [Methods][methods].

For the code documentation, see [Documentation][PAGES].

## License

This package is available under the [MIT license][LICENSE].

<!-- References -->
[LICENSE]: https://github.com/axaptional/electron-ipc/blob/v0.2.0/LICENSE
[ISSUES]: https://github.com/axaptional/electron-ipc/issues
[NPM]: https://www.npmjs.com/package/@axaptional/electron-ipc
[PAGES]: https://axaptional.github.io/electron-ipc/
[STANDARD]: https://standardjs.com

[arguments]: https://github.com/axaptional/electron-ipc/blob/v0.2.0/markdown/arguments.md
[methods]: https://github.com/axaptional/electron-ipc/blob/v0.2.0/markdown/methods.md

[electron-ipc-rx]: https://github.com/axaptional/electron-ipc-rx

[bluebird]: https://github.com/petkaantonov/bluebird
[any-promise]: https://github.com/kevinbeaty/any-promise
