# ao-coverage

A simple coverage handler and server. The basic function provides an SVG badge with the coverage percentage and a link to the uploaded HTML coverage report. Only basic metadata is required to persist to track the latest commits for the linked branches.

Currently, the only supported code coverage format is [Tarpaulin](https://crates.io/crates/cargo-tarpaulin), which is specific to Rust. Recommended formats and pull requests are welcome! If you want an account for this Gitea to interact with this repository, please contact the maintainer at [kjhoerr@submelon.tech](mailto:kjhoerr@submelon.tech).

## License

This project is licensed under [the Parity Public License](LICENSE.md). Currently, proprietary-use licenses are not available and offers will not be considered.