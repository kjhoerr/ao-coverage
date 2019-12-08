# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
[0.2.0]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.2.0
[0.1.0]: https://git.submelon.dev/kjhoerr/ao-coverage/src/tag/v0.1.0
