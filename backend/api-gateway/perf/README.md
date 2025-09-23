# API Gateway Performance Tests

Tools: [Artillery](https://www.artillery.io/)

## Targets

Set environment variables or edit YAML files to point to your Gateway base URL:

- Environment variable: `BASE_URL` (default: `http://localhost:3001`)

## Scenarios

- `smoke.yml`: quick check (low load)
- `load.yml`: ramp to ~1000 concurrent users for MVP SLO checks (<200ms p95)
- `stress.yml`: push beyond normal levels to observe degradation/failure modes

## Run

```
npm run perf:smoke
npm run perf:load
npm run perf:stress
```

Reports (HTML) are written to `perf/results/*.html`.

