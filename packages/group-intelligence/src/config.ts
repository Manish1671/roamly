import type { EngineConfig } from './types.js';
import { ALGORITHM_VERSION } from './types.js';

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  algorithmVersion: ALGORITHM_VERSION,
  weights: {
    budget: 0.3,
    interests: 0.3,
    travelStyle: 0.2,
    climate: 0.1,
    destinationType: 0.1,
  },
  fairness: {
    averageWeight: 0.7,
    minimumWeight: 0.3,
  },
};
