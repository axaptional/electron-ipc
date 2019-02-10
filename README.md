# electron-ipc
[![MIT license](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Documentation Coverage](docs/images/coverage-badge-documentation.svg)]()

An easy-to-use wrapper around Electron's inter-process communication API

## Features

This package supports the following means of asynchronous communication:
- Listeners
- Native Promises
- Custom Promises (like `bluebird`)

### Extensions

**Cancelable Promises**

If you want to use cancelable Promises, just install a Promise library like
[bluebird](https://github.com/petkaantonov/bluebird) supporting this feature,
then register your Promise constructor with `any-promise` like this:
```js
require('any-promise/register/bluebird')
```

`any-promise` is automatically installed through a dependency of this package.
For more information, see
[any-promise](https://github.com/kevinbeaty/any-promise).

