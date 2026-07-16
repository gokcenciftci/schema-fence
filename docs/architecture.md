# Architecture

SchemaFence has a deliberately small pipeline. Each stage has a single responsibility so the CLI remains predictable in CI.

```text
cli.ts
  -> application/diff.ts
      -> io/load-spec.ts
          -> YAML or JSON parser
          -> openapi/validate.ts
      -> compare/compare.ts
          -> openapi/resolve.ts
      -> report/report.ts
```

## Boundaries

| Layer      | Responsibility                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| CLI        | Parses the `diff` command, selects a reporter, and maps known failures to stable exit codes.                     |
| Loader     | Resolves a supplied local path, applies the 5 MiB limit, and parses JSON or a single YAML document.              |
| Validation | Performs v0.1 structural checks, rejects external and unresolved `$ref` values, and rejects cyclic YAML aliases. |
| Resolver   | Resolves supported local JSON Pointer references without filesystem or network I/O.                              |
| Comparison | Runs pure, directional rules from the baseline contract to the candidate contract.                               |
| Reporter   | Serializes the same sorted findings as text or stable JSON.                                                      |

## Compatibility direction

`--base` is the contract that existing consumers know. `--candidate` is the proposed contract. A finding means the candidate has removed or restricted a surface that the baseline documented.

The tool intentionally avoids time stamps, absolute input paths, and random identifiers in its reports. This makes reports suitable for review diffs and scripted assertions.

## Security model

Inputs are untrusted local documents. The loader limits file size and YAML alias expansion; validation uses an iterative object-graph walk to avoid unbounded recursion and to reject cycles. External `$ref` values are rejected instead of fetched, keeping the v0.1 threat model local and deterministic.

## Extending the engine

New rules should remain pure functions that consume the two validated documents and return findings. Add a focused fixture or unit test for every new finding code, document its compatibility rationale, and preserve the global deterministic sort order.
