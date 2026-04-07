# Load test scripts

Use [k6](https://k6.io/) to run these scripts against the NestJS backend.

## Environment variables

- `BASE_URL` default: `http://127.0.0.1:3000`
- `PHONE` required for login
- `PASSWORD` required for login
- `VUS` optional concurrent virtual users
- `DURATION` optional test duration, e.g. `3m`
- `PAGE` optional list/report page number, default `1`
- `PAGE_SIZE` optional page size, default `10`
- `START_DATE` optional report start time, default last 7 days
- `END_DATE` optional report end time, default now

## Examples

```bash
k6 run scripts/load-test/login.js -e BASE_URL=http://127.0.0.1:3000 -e PHONE=13800000000 -e PASSWORD=123456
k6 run scripts/load-test/core-list.js -e BASE_URL=http://127.0.0.1:3000 -e PHONE=13800000000 -e PASSWORD=123456 -e VUS=30 -e DURATION=5m
k6 run scripts/load-test/reports.js -e BASE_URL=http://127.0.0.1:3000 -e PHONE=13800000000 -e PASSWORD=123456 -e START_DATE=2026-04-01T00:00:00.000Z -e END_DATE=2026-04-07T23:59:59.999Z -e VUS=20 -e DURATION=5m
node scripts/load-test/autocannon-smoke.js
PHONE=13800000000 PASSWORD=123456 CONNECTIONS=10 DURATION=20 node scripts/load-test/autocannon-smoke.js
```

## Suggested order

1. `login.js`
2. `core-list.js`
3. `reports.js`

## Suggested load levels

- Smoke: `VUS=10 DURATION=3m`
- Medium: `VUS=30 DURATION=5m`
- Higher: `VUS=50 DURATION=5m`

Watch API error rate, P95 latency, Node CPU/memory, PostgreSQL CPU, active connections, and slow queries.
