import type { Adapter } from './adapter.interface.js';
import { tscAdapter } from './tsc.adapter.js';
import { eslintAdapter } from './eslint.adapter.js';
import { knipAdapter } from './knip.adapter.js';
import { depCruiserAdapter } from './dep-cruiser.adapter.js';
import { outdatedAdapter } from './outdated.adapter.js';
import { securityAdapter } from './security.adapter.js';

export const adapters: Adapter[] = [
  tscAdapter,
  eslintAdapter,
  knipAdapter,
  depCruiserAdapter,
  outdatedAdapter,
  securityAdapter,
];
