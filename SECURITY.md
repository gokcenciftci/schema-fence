# Security policy

## Supported versions

| Version          | Supported |
| ---------------- | --------- |
| `0.1.x`          | Yes       |
| Earlier versions | No        |

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Private vulnerability reporting is enabled for this repository; submit a report through [GitHub Security Advisories](https://github.com/gokcenciftci/schema-fence/security/advisories/new). If that path is temporarily unavailable, contact the repository owner through [their GitHub profile](https://github.com/gokcenciftci) without publishing exploit details.

Include a minimal reproduction, affected version, impact, and any mitigation you have identified. You should receive an acknowledgement within seven days.

## Input-handling boundaries

SchemaFence processes potentially untrusted local JSON/YAML. v0.1 limits inputs to 5 MiB, parses one YAML document at a time, caps aliases, rejects cyclic YAML aliases, rejects external `$ref` values, and does not make network requests. These controls reduce risk; they are not a substitute for reviewing untrusted contracts before placing them in privileged environments.
