    // Tool list rendering
    function renderToolList() {
      const container = document.getElementById('toolList');
      document.getElementById('toolCount').textContent = tools.length;

      if (tools.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div>No tools available from this server</div>
          </div>
        `;
        return;
      }

      clearElement(container);
      tools.forEach((tool, index) => {
        const item = createElement('div', {
          className: `tool-item ${index === 0 ? 'active' : ''}`,
          dataset: { tool: tool.name },
          attrs: { role: 'button', tabindex: '0', 'aria-label': `Select tool ${tool.name}` },
          on: {
            click: () => selectTool(tool.name),
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectTool(tool.name);
              }
            }
          }
        });
        item.appendChild(createElement('div', { className: 'tool-name', text: tool.name }));
        item.appendChild(createElement('div', { className: 'tool-desc', text: tool.description || 'No description' }));
        container.appendChild(item);
      });

      // Select first tool
      if (tools.length > 0) {
        selectTool(tools[0].name);
      }
    }

    // Prompts list rendering
    function renderPromptList() {
      const container = document.getElementById('promptList');
      document.getElementById('promptCount').textContent = prompts.length;

      if (prompts.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
            <div>No prompts available from this server</div>
          </div>
        `;
        return;
      }

      clearElement(container);
      prompts.forEach((prompt, index) => {
        const item = createElement('div', {
          className: `prompt-item ${index === 0 ? 'active' : ''}`,
          dataset: { prompt: prompt.name },
          attrs: { role: 'button', tabindex: '0', 'aria-label': `Select prompt ${prompt.name}` },
          on: {
            click: () => selectPrompt(prompt.name),
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectPrompt(prompt.name);
              }
            }
          }
        });
        item.appendChild(createElement('div', { className: 'prompt-name', text: prompt.name }));
        item.appendChild(createElement('div', { className: 'prompt-desc', text: prompt.description || 'No description' }));
        if (prompt.arguments && prompt.arguments.length > 0) {
          const args = createElement('div', { className: 'prompt-args' });
          prompt.arguments.forEach((arg) => {
            args.appendChild(createElement('span', {
              className: `prompt-arg ${arg.required ? 'required' : ''}`,
              text: arg.name
            }));
          });
          item.appendChild(args);
        }
        container.appendChild(item);
      });

      // Select first prompt
      if (prompts.length > 0) {
        selectPrompt(prompts[0].name);
      }
    }

    function selectPrompt(promptName) {
      selectedPrompt = prompts.find(p => p.name === promptName);
      if (!selectedPrompt) return;

      // Update active state in list
      document.querySelectorAll('.prompt-item').forEach(el => {
        el.classList.toggle('active', el.dataset.prompt === promptName);
      });

      // Render prompt parameters in the test panel if prompts tab is active
      if (currentCapability === 'prompts') {
        renderPromptParams();
      }
    }

    function renderPromptParams() {
      const container = document.getElementById('dynamicParams');

      if (!selectedPrompt) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">No prompt selected</div>';
        return;
      }

      const args = selectedPrompt.arguments || [];

      if (args.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">No arguments required</div>';
        return;
      }

      clearElement(container);
      args.forEach((arg) => {
        const group = createElement('div', { className: 'form-group' });
        const label = createElement('label');
        label.appendChild(createElement('span', { text: arg.name }));
        if (arg.required) {
          label.appendChild(createElement('span', { className: 'required', text: '*' }));
        }
        const input = createElement('input', {
          attrs: {
            type: 'text',
            id: `param_${arg.name}`,
            placeholder: arg.description || ''
          }
        });
        group.appendChild(label);
        group.appendChild(input);
        container.appendChild(group);
      });
    }

    // Resources list rendering
    function renderResourceList() {
      const container = document.getElementById('resourceList');
      document.getElementById('resourceCount').textContent = resources.length;

      if (resources.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <div>No resources available from this server</div>
          </div>
        `;
        return;
      }

      clearElement(container);
      resources.forEach((resource, index) => {
        const item = createElement('div', {
          className: `resource-item ${index === 0 ? 'active' : ''}`,
          dataset: { resource: resource.uri },
          attrs: { role: 'button', tabindex: '0', 'aria-label': `Select resource ${resource.name || resource.uri}` },
          on: {
            click: () => selectResource(resource.uri),
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectResource(resource.uri);
              }
            }
          }
        });
        item.appendChild(createElement('div', { className: 'resource-uri', text: resource.name || resource.uri }));
        item.appendChild(createElement('div', { className: 'resource-type', text: resource.description || resource.uri }));
        if (resource.mimeType) {
          item.appendChild(createElement('span', { className: 'resource-mime', text: resource.mimeType }));
        }
        container.appendChild(item);
      });

      // Select first resource
      if (resources.length > 0) {
        selectResource(resources[0].uri);
      }
    }

    function selectResource(resourceUri) {
      selectedResource = resources.find(r => r.uri === resourceUri);
      if (!selectedResource) return;

      // Update active state in list
      document.querySelectorAll('.resource-item').forEach(el => {
        el.classList.toggle('active', el.dataset.resource === resourceUri);
      });

      // Update params display if resources tab is active
      if (currentCapability === 'resources') {
        renderSelectedResourceSummary();
      }
    }

    function renderToolSelect() {
      const select = document.getElementById('toolSelect');

      if (tools.length === 0) {
        select.innerHTML = '<option value="">-- No tools available --</option>';
        return;
      }

      clearElement(select);
      tools.forEach((tool) => {
        const option = createElement('option', {
          text: tool.name,
          attrs: { value: tool.name }
        });
        select.appendChild(option);
      });
    }

    function selectTool(toolName) {
      selectedTool = tools.find(t => t.name === toolName);
      if (!selectedTool) return;

      // Update active state in list
      document.querySelectorAll('.tool-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tool === toolName);
      });

      // Update dropdown
      document.getElementById('toolSelect').value = toolName;

      // Render parameters
      renderDynamicParams();
    }

    function selectToolFromDropdown() {
      const select = document.getElementById('toolSelect');
      if (select.value) {
        selectTool(select.value);
      }
    }

