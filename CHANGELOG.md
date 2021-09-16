# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cobertura XML format

### Changed

- Moved stage values for gradient to environment and made accessible via metadata
- Refactored upload processing to async/await over promise chaining

## [0.4.4]

### Changed

- Adjusted routes tests to fail properly if HOST_DIR is undefined or has insufficient access control
- Updated node images used in Dockerfile
- Moved environment configuration used in service to Metadata data handler

## [0.4.3]

### Changed

- Fixed templates not correctly identifying context in handleStartup

## [0.4.2]

### Added

- 404 page to handle unknown paths
- TSDoc and TypeDoc to generate documentation

### Changed

- Moved startup processes to async handleStartup function
- Fixed MongoErrors not reporting on startup

## [0.4.1]

### Changed

- Adjusted styling for mobile displays

## [0.4.0]

### Added

- landing page provided at / based on template
- serve favicon at server root

### Changed

- More descriptive output from bash template, with links to the files
- Moved template processing to router, so unit tests can be run without build

## [0.3.3]

### Changed

- Catch promise rejections for POST endpoint
- Default error descriptions for logged errors
- Lowered brightness of generated report badges

## [0.3.2]

### Changed

- Exit application if bash template could not be created, and does not already exist
- Generalize template processing, for unit tests and for future flexibility
- Fixed rounding for default color matcher when inbetween step values
- Use new nullish coalescing operator for environment variable assignments

## [0.3.1]

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
[0.4.4]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.4.4
[0.4.3]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.4.3
[0.4.2]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.4.2
[0.4.1]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.4.1
[0.4.0]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.4.0
[0.3.3]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.3.3
[0.3.2]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.3.2
[0.3.1]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.3.1
[0.3.0]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.3.0
[0.2.1]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.2.1
[0.2.0]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.2.0
[0.1.0]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.1.0
