# Changelog

All notable changes to SchemaFence are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-14

### Added

- Local JSON/YAML OpenAPI 3.0.x comparison with deterministic text and JSON reports.
- Consumer-safe rules for removed paths, operations, request surfaces, and successful response surfaces.
- Explicit exit-code contract for CI.
- Strict TypeScript, linting, formatting, coverage thresholds, built-CLI smoke tests, CodeQL, and Dependabot automation.

### Security

- Local-only input model with 5 MiB file limits, YAML alias limits, cyclic-alias rejection, and external `$ref` rejection.
