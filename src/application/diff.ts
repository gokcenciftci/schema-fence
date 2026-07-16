import type { ComparisonResult, DiffOptions } from '../core/types.js';
import { compareOpenApi } from '../compare/compare.js';
import { loadSpec } from '../io/load-spec.js';

export async function runDiff(options: DiffOptions): Promise<ComparisonResult> {
  const [baseline, candidate] = await Promise.all([
    loadSpec(options.baselinePath),
    loadSpec(options.candidatePath),
  ]);
  return compareOpenApi(baseline, candidate);
}
