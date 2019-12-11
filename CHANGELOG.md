# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Jest for handling tests
- Unit tests for color matcher in formats.ts, loggerConfig in logger.ts

### Changed

- Fixed issue with colorMatcher returning bad values for everything > stage2
- `colorize()` and `printf()` formats apply specifically to console transport

## [0.3.0]

### Added

- Eslint for linting
- Scripts added: `start:dev` for integrated watcher, `start:prod` for running server as production
- Formatting and linting scripts
- Template file converter, and bash template for serving
- Multi-stage dockerfile

### Changed

- Relicensed project under the Parity Public License 7.0.0
- Ensure process exits with error code if error occurred during shutdown

## [0.2.1]

### Added

- Business logic errors for explicit dataflow handling

### Changed

- Changed formats/metadata to return union types with business logic errors
- Fixed 404 responses for all GET endpoints

## [0.2.0]

### Added

- Metadata persisted through a single-document store using MongoDB
- More verbose logging managed by winston (console-only for now)
- Shutdown handling for running services/connections

### Changed

- Even more Promises

## [0.1.0]

### Added

- Workspace, CHANGELOG, README, LICENSE, etc.
- `/v1/` Endpoints: POST for uploading report, GET for svg badge and report file
- Format interfaces
- Format specification for Tarpaulin HTML reports
- Badge creation with color gradients green -> yellow -> red based on coverage percentage
- Code formatting using Prettier

[unreleased]: https://git.submelon.dev/kjhoerr/ao-coverage/src/branch/trunk
[0.3.0]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.3.0
[0.2.1]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.2.1
[0.2.0]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.2.0
[0.1.0]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.1.0
