# Compatibility rules

SchemaFence evaluates changes from a baseline API to a candidate API. All v0.1 findings have severity `breaking` and use a conservative consumer-safe interpretation: removing a documented surface can break an existing client even when the OpenAPI specification permits a more nuanced reading.

| Finding code                    | Trigger                                                            | Rationale                                                         |
| ------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `PATH_REMOVED`                  | A baseline path is absent from the candidate.                      | Clients can no longer reach the documented route.                 |
| `OPERATION_REMOVED`             | A baseline HTTP operation is absent from an existing path.         | The route no longer accepts that method.                          |
| `REQUIRED_PARAMETER_ADDED`      | A candidate adds a required parameter.                             | Existing calls omit it.                                           |
| `PARAMETER_NOW_REQUIRED`        | An optional baseline parameter becomes required.                   | Existing calls may omit it.                                       |
| `REQUEST_BODY_REMOVED`          | A documented request body disappears.                              | Existing clients may send it.                                     |
| `REQUEST_BODY_NOW_REQUIRED`     | A request body becomes required, or a required body is introduced. | Existing calls may not provide a body.                            |
| `REQUEST_MEDIA_TYPE_REMOVED`    | A request media type is removed.                                   | A previously accepted payload encoding is no longer accepted.     |
| `REQUEST_PROPERTY_REMOVED`      | A request property is removed from the supported schema.           | Existing payloads may contain that property.                      |
| `REQUEST_PROPERTY_NOW_REQUIRED` | A request property becomes required.                               | Existing payloads may omit it.                                    |
| `REQUEST_SCHEMA_TYPE_CHANGED`   | A request schema or nested property type changes.                  | The candidate may reject values accepted by the baseline.         |
| `REQUEST_ENUM_VALUE_REMOVED`    | A request enum loses an accepted value.                            | The candidate may reject a previously valid value.                |
| `SUCCESS_RESPONSE_REMOVED`      | An exact `2xx` or `2XX` response is removed.                       | Clients can no longer rely on the documented successful response. |
| `RESPONSE_MEDIA_TYPE_REMOVED`   | A successful response loses a media type.                          | Clients may not be able to decode the response they expect.       |
| `RESPONSE_PROPERTY_REMOVED`     | A successful response schema loses a documented property.          | Clients may read that property.                                   |
| `RESPONSE_SCHEMA_TYPE_CHANGED`  | A successful response schema or nested property type changes.      | Client deserialization can fail or produce a different shape.     |

## Intentional non-rules

v0.1 does not infer full JSON Schema set inclusion. It does not compare compositions, constraints, arrays, security, headers, callbacks, or non-success responses. A rule must be implemented and documented before SchemaFence treats it as part of the compatibility contract.
