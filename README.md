# mcp-web-bridge

Connect any MCP server to Chrome's WebMCP API.

You have MCP servers. You want them in the browser. This module connects to a remote MCP server, discovers its tools, and registers them with `navigator.modelContext`.

```bash
npm install mcp-web-bridge
```

## Usage

```javascript
import { WebMCPBridge } from 'mcp-web-bridge';

const bridge = new WebMCPBridge('https://mcp.example.com');
await bridge.connect();
bridge.register();
```

That's it. Tools are now available to Chrome's AI agent.

## With context enrichment

```javascript
const bridge = new WebMCPBridge('https://mcp.example.com', {
  enrichContext: (toolName, args) => ({
    ...args,
    user_locale: navigator.language,
    user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }),
  onResponse: (toolName, result) => {
    console.log(`[${toolName}]`, result);
    return result;
  },
});

await bridge.connect();
bridge.register();
```

## With auth

```javascript
const bridge = new WebMCPBridge('https://mcp.example.com');
bridge.setAuth({ type: 'bearer', token: 'sk-...' });
await bridge.connect();
```

Supports `bearer`, `apikey`, and `basic` auth. OAuth with PKCE is handled by the `MCPAuth` class.

## Custom headers

```javascript
const bridge = new WebMCPBridge('https://mcp.example.com', {
  headers: {
    'X-Custom-Header': 'value',
    'Authorization': 'Bearer sk-...',
  },
});
```

Custom headers are merged into every request. Auth headers from `setAuth()` are applied first, then your custom headers override.

## Add page-local tools

```javascript
bridge.register([
  {
    name: 'get_selection',
    description: 'Get the currently selected text on the page',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => ({
      content: [{ type: 'text', text: window.getSelection().toString() }],
    }),
  },
]);
```

Mix remote MCP tools with local browser capabilities.

## API

### `new WebMCPBridge(serverUrl, options?)`

| Option | Type | Description |
|--------|------|-------------|
| `headers` | `object` | Custom headers merged into every request |
| `enrichContext` | `(name, args) => args` | Enrich tool args before proxying |
| `onToolCall` | `(name, args) => void` | Called before each tool call |
| `onResponse` | `(name, result) => result` | Transform responses |
| `onError` | `(name, error) => void` | Error handler |
| `logger` | `object` | Custom logger (default: `console`) |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `{ tools, prompts, resources }` | Initialize + discover |
| `register(extraTools?)` | `tool[]` | Register with WebMCP |
| `callTool(name, args)` | `result` | Call a tool |
| `getPrompt(name, args)` | `result` | Get a prompt |
| `readResource(uri)` | `result` | Read a resource |
| `setAuth({ type, token })` | — | Set auth before connecting |
| `disconnect()` | — | Clear context + logout |

## Browser requirements

- Chrome 146+ with `chrome://flags/#enable-webmcp-testing`
- Without WebMCP, `connect()` and `callTool()` still work — you just can't `register()`

## License

MIT
