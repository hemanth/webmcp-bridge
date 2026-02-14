# webmcp-bridge

Browser bridge for remote MCP servers.

Connect to an MCP endpoint, inspect tools/prompts/resources, execute them from the UI, and register tools with WebMCP (`navigator.modelContext`) when available.

Built as a browser-first MCP playground. No build step. No framework.

## quick start

```bash
cd webmcp-bridge
python3 -m http.server 8080
```

Open `http://localhost:8080`.

If `8080` is busy:

```bash
python3 -m http.server 8081
```

## features

- MCP over JSON-RPC (`initialize`, `tools/list`, `prompts/list`, `resources/list`, `tools/call`)
- Tool/prompt/resource explorer + executor
- Chat mode with Prompt API (`window.LanguageModel`) and guarded LLM tool planning
- Prompt API readiness states (`missing`, `downloading`, `ready`, `error`) with chat gating until ready
- Subtle tool-call trace UI ("Using tool ...") with collapsible args for debugging
- OAuth discovery + manual auth options
- WebMCP tool registration for browser AI surfaces

## request flow

1. Connect to MCP server URL
2. Run `initialize`
3. Fetch capabilities (`tools/list`, optional `prompts/list`, optional `resources/list`)
4. Execute selected action
5. Surface results in UI and optionally expose tools via WebMCP

When WebMCP is available, each discovered tool is re-exposed with an `execute(args)` function that proxies to remote `tools/call`.

## project layout

- `index.html` - app shell
- `styles.css` - styles
- `app.js` - bootstrap (`init()`)
- `js/core/` - shared state + init
- `js/auth/` - auth client + auth UI
- `js/mcp/` - parser, connection, execution, WebMCP integration
- `js/ui/` - rendering and interactions
- `js/chat/` - chat flow and tool intent logic
- `js/utils/` - utility helpers

## browser notes

- WebMCP testing currently requires Chrome 146+ and flag:
  - `chrome://flags/#enable-webmcp-testing`
- Prompt API requires browser support for `window.LanguageModel`.
- While the on-device model downloads, chat remains disabled and unlocks automatically when ready.
- Download progress events can be sparse depending on Chrome build; `0%` can persist even when download is in progress.
- Without WebMCP, the app still works as an MCP explorer/test client.
- If the remote MCP server does not allow your origin via CORS, direct browser calls will fail.

## storage behavior

- Recent connections: `localStorage`
- OAuth/client/session metadata: `sessionStorage`
- Manual API key/basic/bearer creds: in memory only

## auth behavior

- Supports OAuth discovery from `/.well-known/oauth-authorization-server`
- Supports dynamic client registration if server exposes `registration_endpoint`
- Supports PKCE auth code flow
- Supports manual API key / basic / bearer for testing

OAuth success in browser depends on endpoint accessibility + CORS on required auth/token routes.
