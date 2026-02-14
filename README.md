# webmcp-bridge

A small browser-side bridge between remote MCP servers and browser AI agents.

I built this as a hands-on experiment: connect to any MCP endpoint, inspect tools/prompts/resources, test them, and expose those tools to `navigator.modelContext` when WebMCP is available.

## what this does

- Connects to a remote MCP server over JSON-RPC.
- Discovers `tools/list`, `prompts/list`, and `resources/list`.
- Lets you execute tools, fetch prompts, and read resources from the UI.
- Registers discovered tools with WebMCP (`navigator.modelContext.provideContext`) so browser agents can call them.
- Includes chat mode with Prompt API fallback behavior.
- Supports OAuth discovery flow + manual auth modes for testing.

## why this exists

There are already many useful MCP servers. Instead of rebuilding everything for the browser, this bridge lets you reuse what already exists and wire it into emerging browser AI surfaces.

## project structure

- `index.html` - app shell and markup
- `styles.css` - styling
- `app.js` - app logic (connection, auth, rendering, execution, chat, WebMCP integration)

## run locally

No build step needed.

```bash
cd webmcp-bridge
python3 -m http.server 8080
```

Then open:

`http://localhost:8080`

You can also use any static file server you prefer.

## browser requirements

- Chrome 146+ for current WebMCP testing path.
- Enable flag: `chrome://flags/#enable-webmcp-testing`
- Relaunch Chrome after enabling.

If WebMCP is not available, the app still works as an MCP explorer/test client.

## usage

1. Enter an MCP server URL.
2. Connect and authenticate (if required).
3. Pick a capability tab: Tools, Prompts, or Resources.
4. Execute and inspect results.
5. Switch to Chat mode to test natural-language flow over discovered tools.

## notes

- Recent connections are stored in localStorage for convenience.
- OAuth/client/session metadata may be kept in sessionStorage during auth flow.
- Manual API key/basic/bearer credentials stay in memory (not persisted).

## not production-hardened

This is a developer-facing playground. It is useful for protocol exploration and quick integration tests, but it is not packaged as a production SaaS/security boundary.

## credits

Made by Hemanth HM.
