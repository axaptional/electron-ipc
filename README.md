# electron-ipc

[![MIT license][BADGE-LICENSE]][LICENSE]
[![Issues][BADGE-ISSUES]][ISSUES]
[![NPM Version][BADGE-NPM]][NPM]
[![JavaScript Style Guide][BADGE-STANDARD]][STANDARD]
[![Documentation Coverage][BADGE-COVERAGE]][PAGES]

An easy-to-use symmetric wrapper around Electron's IPC API

**Note:**
This package is still a **work in progress** and
**has not been extensively tested**.
Therefore, it should not be used in any production environments yet.

## Features

This package allows you to use a normalized, symmetric API for IPC.
This means that both the client and server APIs can be used as if they were
exactly the same.

The following means of asynchronous communication are currently supported:

- listeners
- Node-style callbacks (_not yet available_)
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

Also note that some Promise libraries like `bluebird` require you to enable
cancellation before you can use it.

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

### Serialization

Since Promises can only resolve to _one_ value and to keep consistency,
only single-object messages can be posted and received.

However, you may wrap your data in an array or object literal to
post multiple values, then use parameter destructuring on the receiving end,
like so:

```js
client.post('message', ['one', 'two']).then(({ success, text }) => {
  if (success) {
    console.log(text);
  }
});
```

Keep in mind that any data passed will automatically be serialized to JSON
by Electron.
This means that values such as functions and classes cannot be passed.

Also be aware that objects received by responses via `post` or through channels
via `on` or `once` will have all class prototype information stripped.

### Methods

**NOTE: The documentation is currently outdated but will be updated when 0.4.0 releases**

For short explanations on available methods, as well as
the code documentation, see [Documentation][PAGES].

## License

This package is available under the [MIT license][LICENSE].

<!-- Important references -->
[LICENSE]: https://github.com/axaptional/electron-ipc/blob/master/LICENSE
[ISSUES]: https://github.com/axaptional/electron-ipc/issues
[NPM]: https://www.npmjs.com/package/@axaptional/electron-ipc
[PAGES]: https://axaptional.github.io/electron-ipc/
[STANDARD]: https://standardjs.com

<!-- Badges -->
[BADGE-LICENSE]: https://img.shields.io/github/license/axaptional/electron-ipc.svg
[BADGE-ISSUES]: https://img.shields.io/github/issues/axaptional/electron-ipc.svg
[BADGE-NPM]: https://img.shields.io/npm/v/@axaptional/electron-ipc.svg
[BADGE-STANDARD]: https://img.shields.io/badge/code_style-standard-brightgreen.svg
[BADGE-COVERAGE]: https://raw.githubusercontent.com/axaptional/electron-ipc/master/docs/images/coverage-badge-documentation.svg?sanitize=true

<!-- General references -->
[electron-ipc-rx]: https://github.com/axaptional/electron-ipc-rx
[bluebird]: https://github.com/petkaantonov/bluebird
[any-promise]: https://github.com/kevinbeaty/any-promise
