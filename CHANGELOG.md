# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog][KEEP-A-CHANGELOG],
and this project adheres to [Semantic Versioning][SEMVER].

## [Unreleased]

### Added
- `removeListener` method for removing a single listener
- `respond` method for responding in Promise handlers
- Errors in `on`/`once` listeners lead to the `post` Promise being rejected

### Changed
- Compiled package files are now minimized
- `post` now has the parameters `(channel, data, listener?)`
- `once` with Promises is now called `capture`
- Messages are now encapsulated in a (plain) Message object
- Option-related members were outsourced to a new `OptionsStore` class
- Requests and responses are now handled using local EventEmitters
- Removing a Promise listener now leads to its rejection

### Removed
- Support for listener Cancelers (use `removeListener` instead)
- Support for ResponsivePromises (use `respond` instead)

### Fixed
- Sending no response now results in a value of `undefined` instead of `null`

### Security
- Various security vulnerabilities were fixed through dependency updates

## [0.3.0] - 2019-02-21

### Added
- `post` variant for use with listeners

### Changed
- Only single-object data is allowed for message posts

### Removed
- Support for message atomization

### Fixed
- Responses should now work as intended

## [0.2.1] - 2019-02-16

### Added
- Meta information in `package.json`
- Details on main-to-renderer communication in README.md

### Changed
- Adherence to `tslint:recommended` code style (mostly)
  - [Interfaces will not be prefixed with `I`][no-interface-prefix]

### Removed
- `@types/electron` dependency

### Fixed
- Links in README.md
- Links in CHANGELOG.md
- Member ordering in source files

## [0.2.0] - 2019-02-15

### Added
- Code documentation
- Useful information in README.md
- Additional markdown help
- Options / argument behavior adjustment support

### Changed
- Electron IPC services are now dynamically imported
- Adherence to Standard code style

### Removed
- RxJS support (extension package available at a later date)

### Fixed
- Package exports

## [0.1.0] - 2019-02-10

### Added
- Initial project setup

<!-- General references -->
[KEEP-A-CHANGELOG]: https://keepachangelog.com/en/1.0.0/
[SEMVER]: https://semver.org/spec/v2.0.0.html
[no-interface-prefix]: https://stackoverflow.com/questions/31876947/confused-about-the-interface-and-class-coding-guidelines-for-typescript/41967120#41967120

<!-- Versions -->
[Unreleased]: https://github.com/axaptional/electron-ipc/compare/v0.3.0...HEAD
[0.4.0]: https://github.com/axaptional/electron-ipc/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/axaptional/electron-ipc/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/axaptional/electron-ipc/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/axaptional/electron-ipc/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/axaptional/electron-ipc/releases/tag/v0.1.0
