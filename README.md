# ao-coverage
[![Build Status](https://drone.bleu.fish/api/badges/kjhoerr/ao-coverage/status.svg?ref=refs/heads/trunk)](https://drone.bleu.fish/kjhoerr/ao-coverage)
[![Coverage Status](https://cov.submelon.dev/v1/kjhoerr/ao-coverage/trunk.svg)](https://cov.submelon.dev/v1/kjhoerr/ao-coverage/trunk.xml)
[![Docker Hub](https://img.shields.io/docker/pulls/kjhoerr/ao-coverage)](https://hub.docker.com/r/kjhoerr/ao-coverage)

A simple coverage handler and server. The basic function provides an SVG badge with the coverage percentage and a link to the uploaded coverage report. Only basic metadata is required to persist to track the latest commits for the linked branches.

Currently, the only supported code coverage formats are [Tarpaulin](https://crates.io/crates/cargo-tarpaulin) and [Cobertura XML](https://github.com/cobertura/cobertura). Recommended formats and pull requests are welcome! If you want an account for this Gitea to interact with this repository, please contact the maintainer at [kjhoerr@submelon.tech](mailto:kjhoerr@submelon.tech).

## Roadmap

There is no grand goal of ao-coverage other than hosting coverage reports for projects. That can always be improved, of course - there are feature enhancements, bugs, and discussions under the [Issues tab](https://git.submelon.dev/kjhoerr/ao-coverage/issues) of this project, with milestones for providing ideal target versions or dates.

## Developing

This repository includes a `.devcontainer` to assist with getting developing off the ground as quickly as possible. This includes a Docker image for the repository with installed tools for MongoDB, and MongoDB in a compose stack. The provided image was completely rewritten from the ubuntu base to provide support for `arm64`, so the initial build may take a little while. This comes completely preconfigured with setup data, and a generated TOKEN gets printed to logs when you start the server.

## License

This project is licensed under [the Parity Public License](LICENSE.md). Currently, proprietary-use licenses are not available and offers will not be considered.