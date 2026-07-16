import { SpecError } from '../core/errors.js';
import { asObject, asString } from '../core/guards.js';
import type { JsonObject, OpenApiDocument } from '../core/types.js';

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolvePointer(root: JsonObject, reference: string): unknown {
  if (!reference.startsWith('#/')) return undefined;

  return reference
    .slice(2)
    .split('/')
    .map(decodePointerSegment)
    .reduce<unknown>((current, segment) => asObject(current)?.[segment], root);
}

/** Resolves local OpenAPI references without performing network or filesystem I/O. */
export function resolveLocalObject(
  document: OpenApiDocument,
  value: unknown,
  seen: ReadonlySet<string> = new Set(),
): JsonObject | undefined {
  const object = asObject(value);
  if (!object) return undefined;

  const reference = asString(object.$ref);
  if (!reference) return object;
  if (!reference.startsWith('#/')) {
    throw new SpecError(
      `${document.source}: external $ref values are not supported in v0.1 (${reference}).`,
    );
  }
  if (seen.has(reference)) {
    throw new SpecError(`${document.source}: cyclic local $ref chains are not supported.`);
  }

  const target = resolvePointer(document.raw, reference);
  if (target === undefined) {
    throw new SpecError(`${document.source}: could not resolve local $ref '${reference}'.`);
  }
  const nextSeen = new Set(seen);
  nextSeen.add(reference);
  return resolveLocalObject(document, target, nextSeen);
}
