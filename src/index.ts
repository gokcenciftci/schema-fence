export { compareOpenApi } from './compare/compare.js';
export { SpecError, UsageError } from './core/errors.js';
export type {
  ComparisonResult,
  Finding,
  FindingCode,
  HttpMethod,
  OpenApiDocument,
} from './core/types.js';
export { loadSpec } from './io/load-spec.js';
export { formatJson, formatText } from './report/report.js';
