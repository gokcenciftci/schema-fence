# SchemaFence

[![CI](https://github.com/gokcenciftci/schema-fence/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/gokcenciftci/schema-fence/actions/workflows/ci.yml)
[![CodeQL](https://github.com/gokcenciftci/schema-fence/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/gokcenciftci/schema-fence/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SchemaFence compares two local OpenAPI 3.0.x documents and exits non-zero when its explicitly scoped compatibility rules detect consumer-breaking changes. It is a deterministic, local-first CI gate: it does not fetch remote documents, call external services, or send your API contract anywhere.

> Part of the **Fence Security & Quality Suite** (`SchemaFence`, `ActionFence`, `EnvFence`, `AuditFence`).

> v0.1 is intentionally narrow. It favors predictable behavior and clear limits over claiming complete OpenAPI or JSON Schema coverage.

## Why SchemaFence?

Text diffs can show that an OpenAPI file changed, but they cannot tell a CI pipeline whether a client contract became harder to use. SchemaFence compares the API surface and reports the changes that its consumer-safe rule set classifies as breaking.

It produces either a readable terminal report or a stable JSON document, so the same command works locally and in automation.

## Quick start

SchemaFence is not published to npm yet. Run it from a clone:

```bash
git clone https://github.com/gokcenciftci/schema-fence.git
cd schema-fence
npm ci
npm run build

node dist/cli.js diff \
  --base examples/petstore-v1.yaml \
  --candidate examples/petstore-v2-breaking.yaml
```

Example output:

```text
SchemaFence — OpenAPI compatibility report
Baseline: Pet API v1.0.0 (OpenAPI 3.0.3)
Candidate: Pet API v2.0.0 (OpenAPI 3.0.3)

✖ 7 breaking changes found:
  [PARAMETER_NOW_REQUIRED] POST /pets
    POST /pets makes query parameter 'dryRun' required.
```

For CI-friendly output, add `--format json`.

## CI contract

```bash
node dist/cli.js diff \
  --base api/openapi.before.yaml \
  --candidate api/openapi.yaml \
  --format json
```

| Exit code | Meaning                                                                |
| --------- | ---------------------------------------------------------------------- |
| `0`       | Comparison completed; no breaking changes were found.                  |
| `1`       | Comparison completed; one or more breaking changes were found.         |
| `2`       | The command or its arguments are invalid.                              |
| `3`       | An input/specification safety or structural-validation error occurred. |
| `70`      | An unexpected tool error occurred.                                     |

JSON output is written to standard output; diagnostics are written to standard error. Finding order is deterministic: path, HTTP method, finding code, then location.

## Rules implemented in v0.1

SchemaFence uses a consumer-safe policy. A documented surface that callers may depend on is treated conservatively.

| Area                 | Breaking changes detected                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Paths and operations | A path or HTTP operation is removed.                                                                                      |
| Parameters           | A required parameter is added, or an existing parameter becomes required.                                                 |
| Request bodies       | A documented body is removed, becomes required, or loses a media type.                                                    |
| Request schemas      | A property is removed or made required, a schema type changes, or an accepted enum value is removed.                      |
| Successful responses | An exact `2xx` or `2XX` response, response media type, or documented property is removed; a response schema type changes. |

Detailed finding codes and their rationale are in [the compatibility rules](docs/compatibility-rules.md).

## Supported inputs and deliberate limits

- Local JSON or YAML files only, capped at 5 MiB each.
- Exactly one YAML document per input.
- OpenAPI `3.0.x` documents with basic root and `paths` structural checks. This is not a complete OpenAPI-spec validator.
- Local JSON Pointer `$ref` values beginning with `#/`; missing pointers, external references, cyclic YAML aliases, and direct cyclic `$ref` chains are rejected.
- Schema traversal is intentionally bounded to eight nested levels.

The first release does **not** evaluate `allOf`, `oneOf`, `anyOf`, array-item semantics, `additionalProperties`, constraints such as `minimum` or `pattern`, `nullable`, parameter `content`, security requirements, headers, callbacks, non-success responses, or `default` responses. These gaps mean a clean result is only a result for the rules above—not a proof of complete API compatibility.

## Privacy and input safety

SchemaFence reads only the filesystem paths passed to `diff`. It never fetches remote `$ref` values or contacts a network service. YAML aliases are capped at 100 and cyclic aliases are rejected.

Reports can reveal API titles, versions, paths, parameter/property names, and enum values. Treat CI logs containing SchemaFence reports as contract metadata.

## Architecture

```text
CLI arguments
  -> local spec loader
  -> structural + reference safety checks
  -> local reference resolution
  -> pure comparison rules
  -> deterministic text / JSON reporter
  -> explicit exit code
```

See [architecture notes](docs/architecture.md) for the boundaries between these layers.

## Development

Requires Node.js 20 or newer.

```bash
npm ci
npm run validate
```

`validate` enforces formatting, linting, strict type checks, coverage thresholds, fixture tests, a production build, and built-CLI smoke checks. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) for project practices.

## License

[MIT](LICENSE) © 2026 Gökçen Çiftci
