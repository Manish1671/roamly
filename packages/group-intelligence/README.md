# @roamly/group-intelligence

Pure TypeScript recommendation engine for M4 group destination compatibility.

## Properties

- Deterministic input/output (no randomness, no network, no database).
- Versioned via `ALGORITHM_VERSION` (`group-intelligence-v1.0.0`).
- Explainable scoring with per-criterion breakdowns and hard-constraint rejections.

## Pipeline

1. **Aggregate** member inputs (only `COMPLETE` members participate).
2. **Hard constraints** — shared availability overlap; hard max budget vs indicative destination minimum.
3. **Individual scoring** (0–100) with weights: budget 30%, interests 30%, travel style 20%, climate 10%, destination type 10%.
4. **Group fairness** — `0.7 × average + 0.3 × lowest member` (configurable in `DEFAULT_ENGINE_CONFIG`).
5. **Ranking** — sort by group score, then lowest member score, then destination id.

## Missing data

Incomplete fields score **40** (climate “no preference” scores 75). Hard constraints are never softened.

## Tests

```bash
pnpm --filter @roamly/group-intelligence test
```
