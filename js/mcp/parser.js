    // Helper to parse SSE or JSON response
    async function parseSSEorJSON(response) {
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      // If it's JSON, parse directly
      if (contentType.includes('application/json')) {
        return JSON.parse(text);
      }

      // If it's SSE, extract the JSON from the event data
      if (contentType.includes('text/event-stream') || text.startsWith('event:')) {
        const events = text.split('\n\n').map(chunk => chunk.trim()).filter(Boolean);
        const parsedPayloads = [];

        for (const eventChunk of events) {
          const dataLines = eventChunk
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.substring(5).trim())
            .filter(Boolean);
          if (dataLines.length === 0) continue;

          const dataStr = dataLines.join('\n');
          try {
            parsedPayloads.push(JSON.parse(dataStr));
          } catch (e) {
            console.log('SSE data parse error:', e, dataStr);
          }
        }

        if (parsedPayloads.length > 0) {
          return parsedPayloads[parsedPayloads.length - 1];
        }

        // Try parsing the whole text as JSON as fallback
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error(`Failed to parse SSE response: ${text.substring(0, 100)}...`);
        }
      }

      // Try JSON parse as fallback
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`Unexpected response format: ${text.substring(0, 100)}...`);
      }
    }
