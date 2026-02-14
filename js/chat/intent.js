    function getToolByName(toolName) {
      return tools.find((tool) => tool.name === toolName);
    }

    function extractJsonObject(text) {
      if (!text) return null;
      const trimmed = text.trim();

      // direct JSON
      try {
        return JSON.parse(trimmed);
      } catch {}

      // fenced code block JSON
      const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fencedMatch?.[1]) {
        try {
          return JSON.parse(fencedMatch[1]);
        } catch {}
      }

      // first JSON object fallback
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1));
        } catch {}
      }

      return null;
    }

    function validateToolAction(action) {
      if (!action || typeof action !== 'object') return { valid: false, error: 'Response is not JSON.' };
      if (!action.type || (action.type !== 'tool_call' && action.type !== 'final')) {
        return { valid: false, error: 'Missing or invalid "type". Use "tool_call" or "final".' };
      }
      if (action.type === 'final') {
        if (typeof action.message !== 'string' || action.message.trim() === '') {
          return { valid: false, error: '"final" requires non-empty "message".' };
        }
        return { valid: true };
      }

      if (typeof action.tool !== 'string' || !action.tool.trim()) {
        return { valid: false, error: '"tool_call" requires "tool".' };
      }
      if (action.args == null || typeof action.args !== 'object' || Array.isArray(action.args)) {
        return { valid: false, error: '"tool_call" requires "args" object.' };
      }
      if (!getToolByName(action.tool)) {
        return { valid: false, error: `Unknown tool "${action.tool}".` };
      }
      return { valid: true };
    }

    function extractExplicitStageFromMessage(userMessage) {
      if (!userMessage) return null;
      const message = userMessage.toLowerCase();

      const patterns = [
        /\bstage\s*[:=]?\s*(\d)\b/,
        /\bat\s+stage\s+(\d)\b/,
        /\bstage\s+(\d)\b/
      ];

      for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
          const value = Number(match[1]);
          if (Number.isFinite(value)) return value;
        }
      }
      return null;
    }

    function isStageLookupQuestion(userMessage) {
      if (!userMessage) return false;
      const message = userMessage.trim().toLowerCase();
      return (
        /which\s+stage|what\s+stage|stage\s+is\s+.+\s+(?:on|in|at)/.test(message) ||
        /.+\s+is\s+(?:on|in|at)\??$/.test(message)
      );
    }

    function extractStageLookupSubject(userMessage) {
      if (!userMessage) return null;
      const trimmed = userMessage.trim();
      const match = trimmed.match(/(?:which|what)\s+stage\s+is\s+(.+?)\s+(?:on|in|at)\??$/i);
      const shorthandMatch = trimmed.match(/^(.+?)\s+is\s+(?:on|in|at)\??$/i);
      const rawSubject = match?.[1] || shorthandMatch?.[1];
      if (!rawSubject) return null;
      const subject = rawSubject.trim();
      if (!subject) return null;
      if (/^stage\s+\d+$/i.test(subject)) return null;
      if (/^tc39$/i.test(subject)) return null;
      return subject;
    }

    function validateActionAgainstCurrentRequest(action, userMessage) {
      if (!action || action.type !== 'tool_call') return { valid: true };

      const stageLookupSubject = extractStageLookupSubject(userMessage);
      if (stageLookupSubject && action.tool !== 'search_proposals') {
        return {
          valid: false,
          error: `For "which stage is X on?" queries, call "search_proposals" first with query="${stageLookupSubject}".`
        };
      }

      const stageArgPresent = action.args && Object.prototype.hasOwnProperty.call(action.args, 'stage');
      if (!stageArgPresent) return { valid: true };

      const explicitStage = extractExplicitStageFromMessage(userMessage);
      if (explicitStage == null) {
        // Recovery path: if model invented/retained stage filter, strip it and proceed.
        delete action.args.stage;
        return { valid: true };
      }

      const stageValue = Number(action.args.stage);
      if (!Number.isInteger(stageValue) || stageValue < 0 || stageValue > 4) {
        return { valid: false, error: '"stage" must be an integer between 0 and 4.' };
      }

      if (stageValue !== explicitStage) {
        return {
          valid: false,
          error: `Requested stage must match the user message (expected ${explicitStage}).`
        };
      }

      return { valid: true };
    }

    async function promptWithTimeout(prompt, timeoutMs = 25000) {
      return await Promise.race([
        aiSession.prompt(prompt),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Prompt API timeout after ${timeoutMs}ms`)), timeoutMs);
        })
      ]);
    }

    function buildToolUsePrompt(userMessage, toolHistory = [], previousError = null) {
      const toolList = tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || { type: 'object', properties: {} }
      }));

      const historyText = toolHistory.length > 0
        ? toolHistory.map((h, idx) => {
            const resultStr = typeof h.result === 'string' ? h.result : JSON.stringify(h.result, null, 2);
            return `Step ${idx + 1}\nTool: ${h.tool}\nArgs: ${JSON.stringify(h.args)}\nResult:\n${resultStr}`;
          }).join('\n\n')
        : 'None yet.';

      const errorText = previousError ? `Previous response error: ${previousError}\n` : '';

      return `You are a tool-using assistant.
You must respond with ONLY valid JSON.

Output schema:
{
  "type": "tool_call" | "final",
  "tool": "<tool name if type=tool_call>",
  "args": { ... } ,
  "message": "<final user-facing answer if type=final>"
}

Rules:
- Do not include markdown.
- Do not include extra keys.
- Use "tool_call" if you need more data.
- Use "final" only when ready to answer user.
- For tool calls, choose one tool and produce concrete args.
- Use only constraints from the current user request.
- Never carry over filters (like stage) from earlier chat turns unless explicitly stated now.
- For "which stage is X on?" questions, call search_proposals with query X before any summary tool.
- Treat shorthand like "Error Cause is on?" as a stage lookup for that proposal.
- Never invent sentinel values (for example stage: -1). Omit a field if unknown.
- If asking for the stage of a proposal:
  1. Call search_proposals with {"query":"<proposal name>"} and no stage filter unless user explicitly gave one.
  2. Then return a final answer with the stage from tool results.
- If no proposal match is found, say that clearly in "final" and suggest a close keyword.

Available tools:
${JSON.stringify(toolList, null, 2)}

User request:
${userMessage}

Tool call history:
${historyText}

${errorText}`.trim();
    }

    async function processWithAI(message) {
      const maxSteps = 6;
      const toolHistory = [];
      let previousError = null;

      try {
        const thinkingEl = addChatMessage('assistant', 'Thinking...');

        for (let step = 0; step < maxSteps; step += 1) {
          thinkingEl.innerHTML = renderSimpleMarkdown(`Thinking... (${step + 1}/${maxSteps})`);
          const prompt = buildToolUsePrompt(message, toolHistory, previousError);
          const rawResponse = await promptWithTimeout(prompt);
          const rawText = typeof rawResponse === 'string'
            ? rawResponse
            : (rawResponse?.text || JSON.stringify(rawResponse));
          const parsed = extractJsonObject(rawText);
          const validation = validateToolAction(parsed);

          if (!validation.valid) {
            previousError = validation.error;
            continue;
          }

          const requestValidation = validateActionAgainstCurrentRequest(parsed, message);
          if (!requestValidation.valid) {
            previousError = requestValidation.error;
            continue;
          }

          if (parsed.type === 'final') {
            thinkingEl.innerHTML = renderSimpleMarkdown(parsed.message);
            return;
          }

          addToolCallMessage(parsed.tool, parsed.args);
          const toolResult = await executeToolFromChat(parsed.tool, parsed.args, { echoResultToChat: false });

          if (!toolResult.ok) {
            toolHistory.push({ tool: parsed.tool, args: parsed.args, result: `ERROR: ${toolResult.error}` });
          } else {
            toolHistory.push({ tool: parsed.tool, args: parsed.args, result: toolResult.content });
          }
          previousError = null;
        }

        thinkingEl.innerHTML = renderSimpleMarkdown(
          'I could not complete this with tools in time. Please try refining your request.'
        );
      } catch (error) {
        addChatMessage('assistant', `Error: ${error.message}`);
      }
    }
