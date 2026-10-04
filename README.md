# ENS Agent Router

> One front door for many AI helpers. Each helper describes itself on its own ENS name, so adding a new one never touches the router's code.

Priya's studio has small AI helpers for contracts, brand copy and invoices. Clients kept emailing the wrong one. Now a client asks one question, the right helper answers, and the client sees **which helper** it was. A helper Priya publishes tomorrow is picked up without a deploy.

## How it works

```
DIRECTORY_NAME (env) ──getEnsText(app.agent-router.agents)──▶ list of helper ENS names
   each name ──normalize──▶ getEnsText: description, endpoint, topics     ← discovered at runtime
   malformed / unreachable helper ──▶ skipped, discovery continues
question ──▶ LLM picks one agent from the discovered list (agents as data in a user message)
         ──▶ pick not in the discovered list? ──▶ refused: "no suitable helper"
         ──▶ endpoint = the chosen agent's own ENS record, https only ──▶ POST {"question"} (explicit timeout)
         ──▶ answer + the name of the helper that gave it
```

### Helper records (on each helper's ENS name)

| text record key | meaning |
| --- | --- |
| `description` | what the helper is for (5-300 chars), the standard ENSIP-5 key |
| `app.agent-router.endpoint` | public `https` URL accepting `POST {"question": "..."}` and returning `{"answer": "..."}` (plain text also accepted) |
| `app.agent-router.topics` | optional comma-separated hints |

The **directory** is any ENS name whose `app.agent-router.agents` record lists helper names (comma or newline separated). Add a helper = publish its records and append its name to that one record. No router change, no deploy. Discovery is re-read every `AGENTS_TTL_MS` (default 60 s).

```bash
PRIVATE_KEY=0x... npm run set-agent -- invoices.eth \
  --description "Handles invoices: overdue payments, billing status and reminders." \
  --endpoint https://invoices.example.com/ask --topics "invoices, payments"
PRIVATE_KEY=0x... npm run set-agent -- studio.eth --directory "contracts.eth, brand.eth, invoices.eth"
```

### Guarantees (and where they live)

- **The model can't send traffic anywhere new.** `src/router.ts` accepts the model's choice only if it is one of the agents discovered from ENS; otherwise it refuses and nothing is forwarded.
- **The URL comes from ENS.** `src/forward.ts` calls the endpoint stored on the chosen agent's own record. Not a map, env var or model output.
- **No literal agent list.** The router has no agent names or endpoints in code (enforced by `test/source.test.ts`). The directory name is configuration.
- **Bad records don't break discovery.** `src/directory.ts` skips a helper whose records are missing, malformed, insecure or unreachable, and keeps going.
- **https only.** `src/agent.ts#checkEndpoint` rejects anything but `https` (localhost `http` only with `ALLOW_LOCALHOST_ENDPOINTS=true` for development), URLs with credentials, and private-network hosts. It runs at discovery and again right before the call.
- **Bounded calls.** Forwarding has an explicit timeout (`AGENT_TIMEOUT_MS`), follows no redirects and caps the answer size. The model call has `LLM_TIMEOUT_MS`.
- **Honest "no helper".** No agents, a `null` choice, an unusable model reply, or an undiscovered pick → an explicit no-suitable-helper response. It never falls back to a default helper.
- **Prompt isolation.** Descriptions are untrusted ENS text: they travel as JSON in a user message, never in the system prompt.

## Run it

```bash
npm install
cp .env.example .env     # set DIRECTORY_NAME and LLM_API_KEY
set -a; source .env; set +a
npm start                # http://localhost:3000
```

To try it without hosting helpers, run `npm run mock-agents` (three local helpers on :4001-4003), point helper records at them and start the router with `ALLOW_LOCALHOST_ENDPOINTS=true`.

## Tests and recorded cases

```bash
npm test         # offline: discovery, validation/skip, endpoint safety, routing checks, timeouts, no literal agents, recorded cases
npm run cases    # live: asks your real model to route each recorded case
```

`cases/routing.json` pairs client requests with the helper expected to handle them (overdue invoice → `invoices.eth`, NDA clause → `contracts.eth`, tagline → `brand.eth`) and one request that must reach **no** helper (train route). The fixture studio is in `test/fixtures/agents.json`.
