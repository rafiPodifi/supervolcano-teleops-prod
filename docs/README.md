# SuperVolcano Documentation

Project documentation tree.

## Structure

| Path            | Contents                                      |
| --------------- | --------------------------------------------- |
| `architecture/` | System architecture, schemas, performance     |
| `runbooks/`     | Setup, deployment, troubleshooting, security  |
| `features/`     | Per-feature implementation checklists         |
| `testing/`      | Test plans + accounts                         |
| `product/`      | Product FAQs, demo scripts, readiness reports |
| `archive/`      | Obsolete docs preserved for history           |
| `examples/`     | Robot API code samples (Python, JS, bash)     |

## Robot API quick start

API base URL: `https://<supervolcano-web-prod-cloud-run-url>/api/robot`
(the production Cloud Run service URL — ask the SuperVolcano team for the
current hostname or custom domain; the legacy `*.vercel.app` host is retired).

API keys are issued separately — request from the SuperVolcano team. Never
commit keys to this repo. All requests require:

```http
X-Robot-API-Key: <your_key>
```

Smoke test:

```bash
curl -X GET "$BASE_URL/health" -H "X-Robot-API-Key: $ROBOT_API_KEY"
```

For the full API contract, see `architecture/ROBOT_API.md` and the
Postman collection at `product/SuperVolcano_Robot_API.postman_collection.json`.

## Endpoints (summary)

| Endpoint                         | Method | Description                    |
| -------------------------------- | ------ | ------------------------------ |
| `/api/robot/health`              | GET    | API liveness                   |
| `/api/robot/jobs`                | GET    | List jobs                      |
| `/api/robot/locations`           | GET    | List locations                 |
| `/api/robot/locations/{id}/jobs` | GET    | Jobs for a location            |
| `/api/robot/jobs/{id}/videos`    | GET    | Instructional videos for a job |

Robot endpoints are PostgreSQL-replica-backed; see `architecture/data-layer.md`.

## Code samples

`examples/test.sh`, `examples/example.py`, `examples/example.js` —
ready-to-run smoke clients. Replace the placeholder API key before
running.
