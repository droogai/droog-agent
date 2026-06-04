# Droog Widget — API Contract

Base URL: `https://api.droog.io`

All requests use `Content-Type: application/json`. All responses are plain JSON (no SSE streaming).

---

## Flow overview

Every widget conversation follows a two-step sequence:

```
1.  POST /sessions   →  obtain session_id
2.  POST /chat       →  send messages (reuse session_id for the lifetime of the session)
```

Sessions are stored **in memory** on the FastAPI server. They expire after **20 minutes** of inactivity. If the server restarts, all active sessions are lost. The widget handles this automatically — if `/chat` returns `404`, it silently calls `/sessions` again and replays the message.

---

## POST /sessions

Creates a new chat session and initialises the RAG orchestrator for the given bot.

### Request

```json
{
  "tenant_id": "acme-corp",
  "bot_id": "b01"
}
```

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `tenant_id` | `string` | Yes | — | Droog tenant identifier |
| `bot_id` | `string` | No | `"b01"` | Bot identifier within the tenant |
| `end_user_id` | `string` | No | `null` | Optional end-user tracking ID |
| `llm_model` | `string` | No | `"openai"` | LLM backend to use |
| `doc_filter` | `string[]` | No | `null` | Restrict RAG retrieval to specific documents |
| `enable_query_rewriting` | `boolean` | No | `true` | Rewrite user queries before retrieval |
| `enable_context_summary` | `boolean` | No | `true` | Summarise conversation context |
| `conversation_memory_size` | `integer` | No | `5` | Number of prior turns to keep in context |

> **Widget behaviour:** The widget sends only `tenant_id` and `bot_id`. All other fields use server defaults.

### Response `200 OK`

```json
{
  "session_id": "e8ffde5d-72fe-4dd5-9840-5d985afa7681",
  "tenant_id": "acme-corp",
  "bot_id": "b01",
  "table_name": "acme_corp_docs",
  "lancedb_path": "/data/lancedb/acme-corp",
  "configuration": { "...": "..." },
  "timeout_info": {
    "timeout_minutes": 20,
    "will_expire_at": 1717430000,
    "expires_at_utc": "2024-06-03 14:33:20"
  },
  "flow_orchestrator": {
    "status": "tenant_initialized",
    "model_type": "openai"
  },
  "context_manager": {
    "status": "initialized",
    "memory_window_size": 5
  },
  "created_at_utc": "2024-06-03 14:13:20"
}
```

> **Widget behaviour:** Only `session_id` is extracted and stored in `sessionStorage` under the key `droog_sid_<bot_id>`. Everything else is ignored by the widget.

### Error responses

| Status | Meaning |
|--------|---------|
| `400` | Bot has no knowledge base documents, or bot is not active/published/deployed |
| `404` | Bot or tenant not found |

---

## POST /chat

Sends a user message within an existing session and returns the bot's answer.

### Request

```json
{
  "session_id": "e8ffde5d-72fe-4dd5-9840-5d985afa7681",
  "tenant_id": "acme-corp",
  "bot_id": "b01",
  "query": "How fast can I get started?"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `session_id` | `string` | Yes | Obtained from `POST /sessions` |
| `tenant_id` | `string` | Yes | Must match the session's tenant |
| `bot_id` | `string` | Yes | Must match the session's bot |
| `query` | `string` | Yes | The user's message text |

### Response `200 OK`

```json
{
  "answer": "Hello, I am your Education Consultancy Assistant...",
  "flow_type": "greeting",
  "confidence": 0.95,
  "session_id": "e8ffde5d-72fe-4dd5-9840-5d985afa7681",
  "message_id": "a213b218-7994-4096-8b0d-854736714c6a",
  "recommendations": [],
  "rec_scenario": "rag_only",
  "show_sources": true,
  "sources": [],
  "session_info": {
    "turn_id": 1,
    "session_active": true,
    "minutes_remaining": 20.0,
    "is_lead_captured": false
  },
  "session_end": false,
  "end_reason": null,
  "is_lead_captured": false,
  "endpoint_timing": { "...": "..." }
}
```

| Field | Type | Widget uses it? | Notes |
|-------|------|-----------------|-------|
| `answer` | `string` | **Yes** | The bot's response text, rendered as markdown |
| `show_sources` | `boolean` | **Yes** | If `true` and `sources` is non-empty, sources are shown below the answer |
| `sources` | `object[]` | **Yes** | Array of `{ url, title }` source references |
| `session_end` | `boolean` | **Yes** | If `true`, the session has ended — widget locks input and resets session state |
| `flow_type` | `string` | No | e.g. `"greeting"`, `"rag_only"` |
| `confidence` | `float` | No | RAG retrieval confidence score |
| `session_id` | `string` | No | Echoed back; widget already holds this |
| `message_id` | `string` | No | Per-message UUID |
| `recommendations` | `array` | No | Suggested follow-up prompts (not yet used by widget) |
| `session_info.minutes_remaining` | `float` | No | Time until session expiry |
| `endpoint_timing` | `object` | No | Server-side latency breakdown |

### Error responses

| Status | Meaning | Widget behaviour |
|--------|---------|-----------------|
| `404` | Session not found (expired or server restarted) | Clears `sessionStorage`, silently calls `/sessions` to create a new session, then replays the original message automatically |
| `4xx` / `5xx` | Other errors | Shows "Sorry, something went wrong" in the chat and re-enables input |

---

## Session lifecycle

```
Page loads
  └─ sessionStorage has session_id?
       ├─ Yes → sessionState = 'ready'  (skip /sessions, use stored ID)
       └─ No  → sessionState = 'idle'

User opens chat panel
  └─ sessionState === 'idle'?
       ├─ Yes → POST /sessions → store session_id → sessionState = 'ready'
       └─ No  → show greeting, enable input

User sends message
  └─ POST /chat
       ├─ 200 → render answer
       │    └─ session_end === true → clear session, lock input
       └─ 404 → clear session → POST /sessions (auto-recovery) → replay message
```

---

## CORS

The widget JS runs in the visitor's browser and makes cross-origin requests to `api.droog.io`. The FastAPI server must allow the embedding site's origin:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yoursite.com", "http://localhost:10003"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)
```

---

## Where these values come from in the WordPress plugin

The widget reads all runtime config from `data-` attributes on the `<script>` tag, which the PHP plugin constructs from stored WP settings:

| `data-` attribute | WP setting key | Used in API call |
|-------------------|----------------|-----------------|
| `data-bot-id` | `bot_widget_id` | `bot_id` in both `/sessions` and `/chat` |
| `data-tenant-id` | `tenant_id` | `tenant_id` in both `/sessions` and `/chat` |
| `data-bot-name` | `bot_name` | Not sent to API — display only |
| `data-primary-color` | `primary_color` | Not sent to API — styling only |
| `data-header-bg` | `header_bg_color` | Not sent to API — styling only |
| `data-header-text` | `header_text_color` | Not sent to API — styling only |
| `data-footer-bg` | `footer_bg_color` | Not sent to API — styling only |
| `data-position` | `launcher_position` | Not sent to API — layout only |
| `data-prompts` | `prompts` (JSON array) | Not sent to API — typewriter animation only |
