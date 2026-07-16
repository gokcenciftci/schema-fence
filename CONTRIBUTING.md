# Contributing

Thanks for contributing to SchemaFence. The project prioritizes deterministic behavior, narrow claims, and tests that demonstrate every compatibility rule.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Local workflow

```bash
npm ci
npm run validate
```

`validate` runs ESLint, Prettier verification, strict TypeScript checks, Vitest with enforced coverage thresholds, a production build, and built-CLI smoke checks.

## Adding a rule

1. Keep comparison logic pure and place it in the comparison layer.
2. Add a focused regression test or fixture that asserts the finding code and its operation/location.
3. Update [the rule reference](docs/compatibility-rules.md) and README scope.
4. Preserve deterministic ordering; do not add timestamps, random IDs, or absolute paths to reports.
5. Run `npm run validate` before opening a pull request.

## Pull requests

Use a clear, imperative commit message such as `feat: detect removed response media types` or `fix: reject unresolved local references`. Keep a pull request focused, explain compatibility impact, and include the validation output in its description.

Do not add credentials, production specifications, or sensitive customer data to tests, issues, or screenshots. See [SECURITY.md](SECURITY.md) for vulnerability reporting.
