    function checkAISupport() {
      const aiStatus = document.getElementById('aiStatus');

      let statusHtml = '';

      // Check WebMCP (navigator.modelContext)
      if (navigator.modelContext) {
        statusHtml += `<div style="margin-bottom: 8px; border-left: 2px solid var(--success); padding-left: 10px;">
          <strong>WebMCP Available</strong> - Tools will be registered with navigator.modelContext for browser AI agents.
        </div>`;
      } else {
        statusHtml += `<div style="margin-bottom: 8px; border-left: 2px solid var(--error); padding-left: 10px;">
          <strong>WebMCP Not Available</strong> - Enable in Chrome 146+:
          <ol style="margin: 4px 0 0 16px; line-height: 1.6; font-size: 10px;">
            <li>Go to chrome://flags/#enable-webmcp-testing</li>
            <li>Set to "Enabled" and relaunch</li>
          </ol>
        </div>`;
      }

      // Check window.ai
      if (window.ai && window.ai.languageModel) {
        statusHtml += `<div style="border-left: 2px solid var(--success); padding-left: 10px;">
          <strong>Prompt API Available</strong> - Chat mode enabled with tool calling.
        </div>`;
      } else {
        statusHtml += `<div style="border-left: 2px solid var(--warning); padding-left: 10px;">
          <strong>Prompt API Not Available</strong> - Chat mode will use simple matching.
        </div>`;
      }

      aiStatus.className = 'ai-status';
      aiStatus.innerHTML = statusHtml;
    }
