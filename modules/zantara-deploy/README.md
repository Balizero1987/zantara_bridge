# Zantara MVP (Orchestrator + Agent-Light)

Minimal multi-agent skeleton with a FastAPI orchestrator and a lightweight agent.

## Services
- Orchestrator (FastAPI): `/dispatch`, `/task/{id}`, `/healthz`
  - Receives results via Pub/Sub push at `/pubsub/results` (optional OIDC verify).
- Agent-Light (FastAPI): `/run`, `/healthz` with TTL/budget/idempotency
  - Also supports Pub/Sub push at `/pubsub/push` with optional Google OIDC verification.

## Quick Start (Docker Compose)
1. Build and run:
   - `docker compose up --build`
2. Health checks:
   - Orchestrator: `curl -s localhost:8081/healthz`
   - Agent: `curl -s localhost:8080/healthz`
3. Dispatch a task (HTTP mode):
   - `curl -s -X POST localhost:8081/dispatch -H 'Content-Type: application/json' -d '{"agent":"light","payload":{"msg":"hi"},"ttl":'$(python -c 'import time;print(time.time()+60)')',"budgetCents":10,"idempotencyKey":"abc"}' | jq`

## Run Locally (uvicorn)
Orchestrator:
```
cd services/orchestrator
pip install -r requirements.txt
AGENT_LIGHT_URL=http://localhost:8080 uvicorn app:app --reload --port 8081
```

Agent-Light:
```
cd services/agent_light
pip install -r requirements.txt
AGENT_COST_PER_RUN_CENTS=5 uvicorn app:app --reload --port 8080
```

## Env
See `config.example.env` for available variables. Do not commit real secrets.

## Notes
- This MVP uses in-memory stores for tasks/results and budget. Replace with Firestore/PubSub for production.
- Orchestrator currently calls the agent over HTTP; Pub/Sub wiring can be added next.

## Pub/Sub Push (Agent)
- Endpoint: `POST /pubsub/push`
- Auth: set `PUBSUB_VERIFY_OIDC=true` and `PUBSUB_AUDIENCE` to the push endpoint URL to verify Google OIDC JWT.
- Payload: standard Pub/Sub push message; `message.data` must be base64 JSON. You can pass either a full run object or just the `payload`:
  - Full: `{ "payload": {...}, "ttl": 123, "budgetCents": 10, "idempotencyKey": "k", "traceId": "t" }`
  - Direct payload: `{...}` (the agent treats it as `payload`)

Terraform example for the subscription:
```
resource "google_pubsub_subscription" "codex_sub" {
  name  = "sub-codex"
  topic = google_pubsub_topic.tasks.name

  # Route only codex tasks (optional but recommended)
  filter = "attributes.agent=\"codex\""

  push_config {
    push_endpoint = var.codex_url  # e.g., https://agent.example.com/pubsub/push
    oidc_token {
      service_account_email = google_service_account.codex.email
      audience              = var.codex_url  # set explicit audience
    }
  }

  ack_deadline_seconds       = 20
  message_retention_duration = "1200s"
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_tasks.id
    max_delivery_attempts = 5
  }
}
```

Receiver env (Agent-Light):
- `PUBSUB_VERIFY_OIDC=true`
- `PUBSUB_AUDIENCE=https://agent.example.com/pubsub/push`

## Orchestrator → Pub/Sub (publish mode)
- Set env:
  - `GCP_PROJECT=your-project-id` (or provide `PUBSUB_TOPIC` full path)
  - `PUBSUB_TOPIC_ID=tasks` (default) or `PUBSUB_TOPIC=projects/your-project-id/topics/tasks`
- Call `/dispatch` with `"mode":"pubsub"`:
```
curl -s -X POST localhost:8081/dispatch \
  -H 'Content-Type: application/json' \
  -d '{
    "agent":"codex",
    "mode":"pubsub",
    "payload":{"msg":"hi"},
    "ttl":'$(python -c 'import time;print(time.time()+60)')',
    "budgetCents": 10,
    "idempotencyKey":"abc"
  }'
```
- The orchestrator publishes JSON in `message.data` with attributes: `agent`, `traceId`, and optional `idempotencyKey`.

## Results Flow
- Agent returns results directly in HTTP mode, or:
  - Posts to `callbackUrl` if provided, or
  - Publishes to a `results` Pub/Sub topic (configure `RESULTS_TOPIC` or `RESULTS_TOPIC_ID` + `GCP_PROJECT`).
- Orchestrator can receive pushed results at `/pubsub/results`.
- Enable verification of Google OIDC on results push with:
  - `RESULTS_PUBSUB_VERIFY_OIDC=true`
  - `RESULTS_PUBSUB_AUDIENCE=https://orchestrator.example.com/pubsub/results`

## Terraform (GCP Topics + Subs)
- See `infra/terraform/` for a minimal setup of topics/subscriptions, service accounts, OIDC config and DLQ.
- Copy `terraform.tfvars.example` to `terraform.tfvars`, set `project_id` and push URLs, then `terraform apply`.

## Local Emulator Bridge (simulate push)
Pub/Sub emulator does not support push. Use the bridge to forward pull messages as HTTP push:

1. Ensure the pubsub emulator is running (see your docker-compose or run Cloud SDK container).
2. In a new shell:
```
cd scripts/pubsub_bridge
pip install -r requirements.txt
export PUBSUB_EMULATOR_HOST=localhost:8082
export GCP_PROJECT=zantara-dev
export AGENT_PUSH_URL=http://localhost:8080/pubsub/push
export ORCH_RESULTS_URL=http://localhost:8081/pubsub/results
python bridge.py
```
3. Dispatch with `mode:"pubsub"`. The bridge will pull from `tasks` and forward to the agent, then forward `results` back to the orchestrator.
