/**
 * Parse SSE or JSON response from MCP server.
 */
export async function parseSSEorJSON(response) {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('application/json')) {
        return JSON.parse(text);
    }

    if (contentType.includes('text/event-stream') || text.startsWith('event:')) {
        const events = text.split('\n\n').map(c => c.trim()).filter(Boolean);
        const payloads = [];

        for (const chunk of events) {
            const data = chunk
                .split('\n')
                .filter(l => l.startsWith('data:'))
                .map(l => l.substring(5).trim())
                .filter(Boolean)
                .join('\n');
            if (!data) continue;
            try { payloads.push(JSON.parse(data)); } catch { }
        }

        if (payloads.length > 0) return payloads[payloads.length - 1];

        try { return JSON.parse(text); } catch {
            throw new Error(`Failed to parse SSE response: ${text.substring(0, 100)}...`);
        }
    }

    try { return JSON.parse(text); } catch {
        throw new Error(`Unexpected response format: ${text.substring(0, 100)}...`);
    }
}
