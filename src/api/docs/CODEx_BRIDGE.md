# Codex Bridge

Endpoints for dispatching tasks to Codex and polling their status.

## Dispatch
`POST /actions/codex/dispatch`

Headers:
- `Authorization: Bearer <token>`
- `X-Idempotency-Key: <uuid>`

Body:
```json
{
  "event_type": "codex-apply-patch",
  "payload": {"branch": "codex/test", "title": "patch test", "patch_b64": "..."}
}
```

Returns `request_id` to poll.

## Status
`GET /actions/codex/status/{request_id}`

Returns current status (`queued`, `running`, `done`, `error`) and optional output.
