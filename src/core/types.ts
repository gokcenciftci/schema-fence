export const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type JsonObject = Record<string, unknown>;

export type FindingCode =
  | 'PATH_REMOVED'
  | 'OPERATION_REMOVED'
  | 'REQUIRED_PARAMETER_ADDED'
  | 'PARAMETER_NOW_REQUIRED'
  | 'REQUEST_BODY_REMOVED'
  | 'REQUEST_BODY_NOW_REQUIRED'
  | 'REQUEST_MEDIA_TYPE_REMOVED'
  | 'REQUEST_PROPERTY_REMOVED'
  | 'REQUEST_PROPERTY_NOW_REQUIRED'
  | 'REQUEST_SCHEMA_TYPE_CHANGED'
  | 'REQUEST_ENUM_VALUE_REMOVED'
  | 'SUCCESS_RESPONSE_REMOVED'
  | 'RESPONSE_MEDIA_TYPE_REMOVED'
  | 'RESPONSE_PROPERTY_REMOVED'
  | 'RESPONSE_SCHEMA_TYPE_CHANGED';

export interface Finding {
  readonly code: FindingCode;
  readonly severity: 'breaking';
  readonly path: string;
  readonly method?: HttpMethod;
  readonly location: string;
  readonly summary: string;
}

export interface ApiIdentity {
  readonly openapi: string;
  readonly title: string;
  readonly version: string;
}

export interface ComparisonResult {
  readonly schemaVersion: '1.0';
  readonly baseline: ApiIdentity;
  readonly candidate: ApiIdentity;
  readonly summary: {
    readonly breaking: number;
  };
  readonly findings: readonly Finding[];
}

export interface OpenApiDocument {
  readonly source: string;
  readonly raw: JsonObject;
  readonly openapi: string;
  readonly info: JsonObject;
  readonly paths: JsonObject;
  readonly components: JsonObject;
}

export type ReportFormat = 'text' | 'json';

export interface DiffOptions {
  readonly baselinePath: string;
  readonly candidatePath: string;
  readonly format: ReportFormat;
}
