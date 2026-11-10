import { installSummaryBoundary } from './summary.js';

export const name = 'session-performance';
export const inject = ['apiProxy'];

export function apply(ctx) {
  ctx.effect(() => installSummaryBoundary(ctx.apiProxy), 'session-performance: compact list response');
}

