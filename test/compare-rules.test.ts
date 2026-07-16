import { describe, expect, it } from 'vitest';
import { compareOpenApi } from '../src/compare/compare.js';
import { validateOpenApiDocument } from '../src/openapi/validate.js';

function content(schema: unknown, mediaType = 'application/json') {
  return { [mediaType]: { schema } };
}

function responses(schema: unknown = { type: 'object' }, mediaType = 'application/json') {
  return {
    '200': {
      description: 'Successful response',
      content: content(schema, mediaType),
    },
  };
}

function requestBody(schema: unknown, mediaType = 'application/json') {
  return { content: content(schema, mediaType) };
}

function operation(
  options: {
    readonly parameters?: unknown[];
    readonly requestBody?: unknown;
    readonly responses?: unknown;
  } = {},
) {
  const value: Record<string, unknown> = {
    responses: options.responses ?? responses(),
  };
  if (options.parameters) value.parameters = options.parameters;
  if (options.requestBody) value.requestBody = options.requestBody;
  return value;
}

function document(pathItem: Record<string, unknown>) {
  return validateOpenApiDocument(
    {
      openapi: '3.0.3',
      info: { title: 'Rule test API', version: '1.0.0' },
      paths: { '/widgets': pathItem },
    },
    'memory',
  );
}

function findingCodes(
  baselinePathItem: Record<string, unknown>,
  candidatePathItem: Record<string, unknown>,
) {
  return compareOpenApi(document(baselinePathItem), document(candidatePathItem)).findings.map(
    (finding) => finding.code,
  );
}

describe('comparison rules not covered by the primary fixture', () => {
  it('detects a removed operation on an existing path', () => {
    expect(findingCodes({ post: operation() }, {})).toContain('OPERATION_REMOVED');
  });

  it('detects a newly required parameter', () => {
    expect(
      findingCodes(
        { post: operation() },
        {
          post: operation({
            parameters: [
              { name: 'workspace', in: 'query', required: true, schema: { type: 'string' } },
            ],
          }),
        },
      ),
    ).toContain('REQUIRED_PARAMETER_ADDED');
  });

  it('detects a removed request body', () => {
    expect(
      findingCodes(
        { post: operation({ requestBody: requestBody({ type: 'object' }) }) },
        { post: operation() },
      ),
    ).toContain('REQUEST_BODY_REMOVED');
  });

  it('detects a removed request media type', () => {
    expect(
      findingCodes(
        { post: operation({ requestBody: requestBody({ type: 'object' }) }) },
        {
          post: operation({ requestBody: requestBody({ type: 'object' }, 'application/xml') }),
        },
      ),
    ).toContain('REQUEST_MEDIA_TYPE_REMOVED');
  });

  it('detects a removed request property', () => {
    expect(
      findingCodes(
        {
          post: operation({
            requestBody: requestBody({
              type: 'object',
              properties: { label: { type: 'string' } },
            }),
          }),
        },
        { post: operation({ requestBody: requestBody({ type: 'object', properties: {} }) }) },
      ),
    ).toContain('REQUEST_PROPERTY_REMOVED');
  });

  it('detects a request schema type change', () => {
    expect(
      findingCodes(
        { post: operation({ requestBody: requestBody({ type: 'string' }) }) },
        { post: operation({ requestBody: requestBody({ type: 'integer' }) }) },
      ),
    ).toContain('REQUEST_SCHEMA_TYPE_CHANGED');
  });

  it('detects a removed response media type', () => {
    expect(
      findingCodes(
        { post: operation({ responses: responses() }) },
        { post: operation({ responses: responses({ type: 'object' }, 'application/xml') }) },
      ),
    ).toContain('RESPONSE_MEDIA_TYPE_REMOVED');
  });
});
