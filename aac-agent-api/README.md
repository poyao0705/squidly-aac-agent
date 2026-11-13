# AAC Agent API

Behavior-preserving port of `SquidlySession/src/Features/Agent/aac-openai-agent`.

## Setup

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Set OPENAI_API_KEY in .env, then:
pnpm dev
```

The server listens on `http://localhost:3000`. The original model, `gpt-6-luna`, is unchanged; your OpenAI account must have access to it.

```sh
curl http://localhost:3000/agent \
  -H 'Content-Type: application/json' \
  -d '{"query":"Create a food board with 3 rows and 4 columns"}'
```

To run the compiled server with the same environment file:

```sh
pnpm build
node --env-file=.env dist/index.js
```

## Run context

`src/schema/context.ts` defines the application data once in Zod:

- `BoardRequirements` and `BoardContext` are inferred from their schemas.
- `RequestMessageState` combines `BoardContext` with the SDK's `AgentInputItem[]` history type.
- `BoardContextSchema` includes requirements and a nullable board draft; older requirements-only objects default to `board: null`.

Modify the schemas to evolve application context; dependent TypeScript types follow automatically. SDK history remains an SDK-owned type, not a duplicated application schema.

Each turn loads history and a copy of saved context, clears only the working board, then calls `run(agent, messages, { context })`. Dynamic instructions expose saved requirements, since local context is not automatically model-visible.

The agent calls `update_board_context` from `src/agents/tools.ts` with a complete `{ requirements, board }` snapshot. The tool validates before updating `runContext.context` and returns the requirements as confirmation. It accepts `board: null` while clarifying or as an intermediate update; a submitted board must match complete requirements. Tool schemas remain even though the agent no longer has a structured final-output schema.

The agent's final reply is ordinary text. The service requires a successful update tool execution in that run, validates `result.runContext.context`, and constructs the existing clarification/success response itself. It rejects complete requirements without a submitted board and saves context/history together only after all checks. Failed turns do not replace saved state; prior boards cannot silently become a new turn's result.

POST `/agent` with `{ "query": "..." }` and receive `{ "message": "...", "outputBoard": null | <converted board> }`. `src/services/openboard-converter.ts` converts validated drafts before state is saved: it adds board/button IDs and `format: "open-board-0.1"`, builds row-major `grid.order` (padding empty cells with `null`), and replaces each button's nested `image` query with an `image_id` reference. Grids exceeding 10,000 total cells or 10,000 on either axis, and boards with more buttons than grid cells, are rejected without saving the turn. Internal context/history keep the draft format; requirements are not added to the response.

Image entries contain unique label-based `id` values, `name`, the original `search_keyword`, and a placeholder `url` of `/images/<encoded-image-id>.png`. Blank labels use `image-<1-based position>` and collisions receive numeric suffixes. These paths do not serve images yet; replace the converter's `getImageUrl()` with real retrieval later. Dimensions and asset metadata are deliberately omitted, so this is an intermediate OpenBoard representation: resolve those fields before calling `OBImage.make()`.

The route still uses `"user_abc"`, so all HTTP callers share one conversation. Storage is unbounded, process-local, and lost on restart; there are no ownership checks or concurrent-turn serialization. Replace this prototype key/storage before multi-user production use.

## Checks

```sh
pnpm test
pnpm build
```

Tests use a scripted SDK model with tracing disabled; they need no API key or network access.
