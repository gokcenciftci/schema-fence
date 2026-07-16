import {
  asBoolean,
  asObject,
  asString,
  asStringArray,
  compareStrings,
  sortedEntries,
} from '../core/guards.js';
import { HTTP_METHODS } from '../core/types.js';
import type {
  ComparisonResult,
  Finding,
  FindingCode,
  HttpMethod,
  JsonObject,
  OpenApiDocument,
} from '../core/types.js';
import { resolveLocalObject } from '../openapi/resolve.js';
import { apiIdentity } from '../openapi/validate.js';

const MAX_SCHEMA_DEPTH = 8;

type SchemaDirection = 'request' | 'response';

interface OperationContext {
  readonly path: string;
  readonly method: HttpMethod;
}

function finding(
  code: FindingCode,
  context: OperationContext,
  location: string,
  summary: string,
): Finding {
  return {
    code,
    severity: 'breaking',
    path: context.path,
    method: context.method,
    location,
    summary,
  };
}

function operationLabel(context: OperationContext): string {
  return `${context.method.toUpperCase()} ${context.path}`;
}

function objectAt(document: OpenApiDocument, value: unknown): JsonObject | undefined {
  return resolveLocalObject(document, value);
}

function arrayAt(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function operationAt(
  document: OpenApiDocument,
  pathItem: JsonObject,
  method: HttpMethod,
): JsonObject | undefined {
  return objectAt(document, pathItem[method]);
}

function parameterKey(parameter: JsonObject): string | undefined {
  const where = asString(parameter.in);
  const name = asString(parameter.name);
  if (!where || !name) return undefined;
  return `${where}:${where === 'header' ? name.toLowerCase() : name}`;
}

function collectParameters(
  document: OpenApiDocument,
  pathItem: JsonObject,
  operation: JsonObject,
): Map<string, JsonObject> {
  const parameters = new Map<string, JsonObject>();
  for (const rawParameter of [...arrayAt(pathItem.parameters), ...arrayAt(operation.parameters)]) {
    const parameter = objectAt(document, rawParameter);
    if (!parameter) continue;
    const key = parameterKey(parameter);
    if (key) parameters.set(key, parameter);
  }
  return parameters;
}

function requestBodyAt(document: OpenApiDocument, operation: JsonObject): JsonObject | undefined {
  return objectAt(document, operation.requestBody);
}

function contentOf(document: OpenApiDocument, value: JsonObject | undefined): JsonObject {
  return objectAt(document, value?.content) ?? {};
}

function schemaOf(document: OpenApiDocument, mediaType: unknown): JsonObject | undefined {
  const content = objectAt(document, mediaType);
  return objectAt(document, content?.schema);
}

function propertiesOf(schema: JsonObject): JsonObject {
  return asObject(schema.properties) ?? {};
}

function requiredProperties(schema: JsonObject): ReadonlySet<string> {
  return new Set(asStringArray(schema.required));
}

function enumValues(schema: JsonObject): ReadonlySet<string> | undefined {
  if (!Array.isArray(schema.enum)) return undefined;
  return new Set(schema.enum.map((value) => JSON.stringify(value)));
}

function schemaType(schema: JsonObject): string | undefined {
  return asString(schema.type);
}

function compareSchema(
  baselineDocument: OpenApiDocument,
  candidateDocument: OpenApiDocument,
  baselineSchema: JsonObject | undefined,
  candidateSchema: JsonObject | undefined,
  context: OperationContext,
  location: string,
  direction: SchemaDirection,
  depth = 0,
): Finding[] {
  if (!baselineSchema || !candidateSchema || depth >= MAX_SCHEMA_DEPTH) return [];

  const findings: Finding[] = [];
  const baselineType = schemaType(baselineSchema);
  const candidateType = schemaType(candidateSchema);
  if (baselineType && candidateType && baselineType !== candidateType) {
    findings.push(
      finding(
        direction === 'request' ? 'REQUEST_SCHEMA_TYPE_CHANGED' : 'RESPONSE_SCHEMA_TYPE_CHANGED',
        context,
        location,
        `${operationLabel(context)} changes ${direction} schema type from '${baselineType}' to '${candidateType}'.`,
      ),
    );
  }

  const baselineProperties = propertiesOf(baselineSchema);
  const candidateProperties = propertiesOf(candidateSchema);
  for (const [propertyName, baselineProperty] of sortedEntries(baselineProperties)) {
    const candidateProperty = candidateProperties[propertyName];
    const propertyLocation = `${location}.properties.${propertyName}`;
    if (!candidateProperty) {
      const code =
        direction === 'request' ? 'REQUEST_PROPERTY_REMOVED' : 'RESPONSE_PROPERTY_REMOVED';
      findings.push(
        finding(
          code,
          context,
          propertyLocation,
          `${operationLabel(context)} removes ${direction} property '${propertyName}'.`,
        ),
      );
      continue;
    }

    findings.push(
      ...compareSchema(
        baselineDocument,
        candidateDocument,
        objectAt(baselineDocument, baselineProperty),
        objectAt(candidateDocument, candidateProperty),
        context,
        propertyLocation,
        direction,
        depth + 1,
      ),
    );
  }

  if (direction === 'request') {
    const baselineRequired = requiredProperties(baselineSchema);
    for (const propertyName of requiredProperties(candidateSchema)) {
      if (!baselineRequired.has(propertyName)) {
        findings.push(
          finding(
            'REQUEST_PROPERTY_NOW_REQUIRED',
            context,
            `${location}.required.${propertyName}`,
            `${operationLabel(context)} makes request property '${propertyName}' required.`,
          ),
        );
      }
    }

    const baselineEnum = enumValues(baselineSchema);
    const candidateEnum = enumValues(candidateSchema);
    if (baselineEnum && candidateEnum) {
      for (const value of baselineEnum) {
        if (!candidateEnum.has(value)) {
          findings.push(
            finding(
              'REQUEST_ENUM_VALUE_REMOVED',
              context,
              `${location}.enum`,
              `${operationLabel(context)} no longer accepts request enum value ${value}.`,
            ),
          );
        }
      }
    }
  }

  return findings;
}

function compareParameters(
  baselineDocument: OpenApiDocument,
  candidateDocument: OpenApiDocument,
  baselinePathItem: JsonObject,
  candidatePathItem: JsonObject,
  baselineOperation: JsonObject,
  candidateOperation: JsonObject,
  context: OperationContext,
): Finding[] {
  const findings: Finding[] = [];
  const baselineParameters = collectParameters(
    baselineDocument,
    baselinePathItem,
    baselineOperation,
  );
  const candidateParameters = collectParameters(
    candidateDocument,
    candidatePathItem,
    candidateOperation,
  );

  for (const [key, candidateParameter] of candidateParameters) {
    const baselineParameter = baselineParameters.get(key);
    const [where, name] = key.split(':');
    const location = `parameters.${key}`;
    const required = asBoolean(candidateParameter.required) === true;

    if (required && !baselineParameter) {
      findings.push(
        finding(
          'REQUIRED_PARAMETER_ADDED',
          context,
          location,
          `${operationLabel(context)} adds required ${where ?? 'unknown'} parameter '${name ?? key}'.`,
        ),
      );
      continue;
    }

    if (required && baselineParameter && asBoolean(baselineParameter.required) !== true) {
      findings.push(
        finding(
          'PARAMETER_NOW_REQUIRED',
          context,
          location,
          `${operationLabel(context)} makes ${where ?? 'unknown'} parameter '${name ?? key}' required.`,
        ),
      );
    }
  }

  for (const [key, baselineParameter] of baselineParameters) {
    const candidateParameter = candidateParameters.get(key);
    if (!candidateParameter) continue;
    findings.push(
      ...compareSchema(
        baselineDocument,
        candidateDocument,
        objectAt(baselineDocument, baselineParameter.schema),
        objectAt(candidateDocument, candidateParameter.schema),
        context,
        `parameters.${key}.schema`,
        'request',
      ),
    );
  }

  return findings;
}

function compareRequestBody(
  baselineDocument: OpenApiDocument,
  candidateDocument: OpenApiDocument,
  baselineOperation: JsonObject,
  candidateOperation: JsonObject,
  context: OperationContext,
): Finding[] {
  const baselineBody = requestBodyAt(baselineDocument, baselineOperation);
  const candidateBody = requestBodyAt(candidateDocument, candidateOperation);
  const findings: Finding[] = [];

  if (baselineBody && !candidateBody) {
    findings.push(
      finding(
        'REQUEST_BODY_REMOVED',
        context,
        'requestBody',
        `${operationLabel(context)} removes its documented request body.`,
      ),
    );
    return findings;
  }

  if (!candidateBody) return findings;
  if (!baselineBody && asBoolean(candidateBody.required) === true) {
    findings.push(
      finding(
        'REQUEST_BODY_NOW_REQUIRED',
        context,
        'requestBody.required',
        `${operationLabel(context)} adds a required request body.`,
      ),
    );
  }
  if (
    baselineBody &&
    asBoolean(baselineBody.required) !== true &&
    asBoolean(candidateBody.required) === true
  ) {
    findings.push(
      finding(
        'REQUEST_BODY_NOW_REQUIRED',
        context,
        'requestBody.required',
        `${operationLabel(context)} makes its request body required.`,
      ),
    );
  }
  if (!baselineBody) return findings;

  const baselineContent = contentOf(baselineDocument, baselineBody);
  const candidateContent = contentOf(candidateDocument, candidateBody);
  for (const [mediaType, baselineMedia] of sortedEntries(baselineContent)) {
    const candidateMedia = candidateContent[mediaType];
    if (!candidateMedia) {
      findings.push(
        finding(
          'REQUEST_MEDIA_TYPE_REMOVED',
          context,
          `requestBody.content.${mediaType}`,
          `${operationLabel(context)} no longer accepts request media type '${mediaType}'.`,
        ),
      );
      continue;
    }
    findings.push(
      ...compareSchema(
        baselineDocument,
        candidateDocument,
        schemaOf(baselineDocument, baselineMedia),
        schemaOf(candidateDocument, candidateMedia),
        context,
        `requestBody.content.${mediaType}.schema`,
        'request',
      ),
    );
  }

  return findings;
}

function successfulResponses(document: OpenApiDocument, operation: JsonObject): JsonObject {
  const responses = objectAt(document, operation.responses) ?? {};
  return Object.fromEntries(
    sortedEntries(responses).filter(([status]) => /^2(?:\d\d|XX)$/.test(status)),
  ) as JsonObject;
}

function compareResponses(
  baselineDocument: OpenApiDocument,
  candidateDocument: OpenApiDocument,
  baselineOperation: JsonObject,
  candidateOperation: JsonObject,
  context: OperationContext,
): Finding[] {
  const findings: Finding[] = [];
  const baselineResponses = successfulResponses(baselineDocument, baselineOperation);
  const candidateResponses = successfulResponses(candidateDocument, candidateOperation);

  for (const [status, baselineResponse] of sortedEntries(baselineResponses)) {
    const candidateResponse = candidateResponses[status];
    if (!candidateResponse) {
      findings.push(
        finding(
          'SUCCESS_RESPONSE_REMOVED',
          context,
          `responses.${status}`,
          `${operationLabel(context)} removes successful response '${status}'.`,
        ),
      );
      continue;
    }

    const baselineContent = contentOf(
      baselineDocument,
      objectAt(baselineDocument, baselineResponse),
    );
    const candidateContent = contentOf(
      candidateDocument,
      objectAt(candidateDocument, candidateResponse),
    );
    for (const [mediaType, baselineMedia] of sortedEntries(baselineContent)) {
      const candidateMedia = candidateContent[mediaType];
      if (!candidateMedia) {
        findings.push(
          finding(
            'RESPONSE_MEDIA_TYPE_REMOVED',
            context,
            `responses.${status}.content.${mediaType}`,
            `${operationLabel(context)} no longer returns response media type '${mediaType}' for '${status}'.`,
          ),
        );
        continue;
      }
      findings.push(
        ...compareSchema(
          baselineDocument,
          candidateDocument,
          schemaOf(baselineDocument, baselineMedia),
          schemaOf(candidateDocument, candidateMedia),
          context,
          `responses.${status}.content.${mediaType}.schema`,
          'response',
        ),
      );
    }
  }

  return findings;
}

function compareOperation(
  baselineDocument: OpenApiDocument,
  candidateDocument: OpenApiDocument,
  baselinePathItem: JsonObject,
  candidatePathItem: JsonObject,
  baselineOperation: JsonObject,
  candidateOperation: JsonObject,
  context: OperationContext,
): Finding[] {
  return [
    ...compareParameters(
      baselineDocument,
      candidateDocument,
      baselinePathItem,
      candidatePathItem,
      baselineOperation,
      candidateOperation,
      context,
    ),
    ...compareRequestBody(
      baselineDocument,
      candidateDocument,
      baselineOperation,
      candidateOperation,
      context,
    ),
    ...compareResponses(
      baselineDocument,
      candidateDocument,
      baselineOperation,
      candidateOperation,
      context,
    ),
  ];
}

function methodRank(method: HttpMethod | undefined): number {
  return method ? HTTP_METHODS.indexOf(method) : -1;
}

function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (left, right) =>
      compareStrings(left.path, right.path) ||
      methodRank(left.method) - methodRank(right.method) ||
      compareStrings(left.code, right.code) ||
      compareStrings(left.location, right.location),
  );
}

export function compareOpenApi(
  baselineDocument: OpenApiDocument,
  candidateDocument: OpenApiDocument,
): ComparisonResult {
  const findings: Finding[] = [];

  for (const [path, baselinePathItemRaw] of sortedEntries(baselineDocument.paths)) {
    const baselinePathItem = objectAt(baselineDocument, baselinePathItemRaw);
    if (!baselinePathItem) continue;
    const candidatePathItem = objectAt(candidateDocument, candidateDocument.paths[path]);

    if (!candidatePathItem) {
      findings.push({
        code: 'PATH_REMOVED',
        severity: 'breaking',
        path,
        location: `paths.${path}`,
        summary: `Path '${path}' was removed.`,
      });
      continue;
    }

    for (const method of HTTP_METHODS) {
      const baselineOperation = operationAt(baselineDocument, baselinePathItem, method);
      if (!baselineOperation) continue;

      const context = { path, method } as const;
      const candidateOperation = operationAt(candidateDocument, candidatePathItem, method);
      if (!candidateOperation) {
        findings.push(
          finding(
            'OPERATION_REMOVED',
            context,
            `paths.${path}.${method}`,
            `${operationLabel(context)} was removed.`,
          ),
        );
        continue;
      }

      findings.push(
        ...compareOperation(
          baselineDocument,
          candidateDocument,
          baselinePathItem,
          candidatePathItem,
          baselineOperation,
          candidateOperation,
          context,
        ),
      );
    }
  }

  const sortedFindings = sortFindings(findings);
  return {
    schemaVersion: '1.0',
    baseline: apiIdentity(baselineDocument),
    candidate: apiIdentity(candidateDocument),
    summary: { breaking: sortedFindings.length },
    findings: sortedFindings,
  };
}
