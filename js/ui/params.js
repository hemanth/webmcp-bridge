    function renderDynamicParams() {
      const container = document.getElementById('dynamicParams');

      if (!selectedTool || !selectedTool.inputSchema) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">No parameters</div>';
        return;
      }

      const schema = selectedTool.inputSchema;
      const properties = schema.properties || {};
      const required = schema.required || [];

      if (Object.keys(properties).length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">No parameters required</div>';
        return;
      }

      clearElement(container);
      Object.entries(properties).forEach(([name, prop]) => {
        const isRequired = required.includes(name);
        const type = Array.isArray(prop.type) ? prop.type[0] : (prop.type || 'string');

        const group = createElement('div', { className: 'form-group' });
        const label = createElement('label');
        label.appendChild(createElement('span', { text: name }));
        if (isRequired) {
          label.appendChild(createElement('span', { className: 'required', text: '*' }));
        }
        label.appendChild(createElement('span', { className: 'param-type', text: type }));
        group.appendChild(label);

        let inputEl;
        if (Array.isArray(prop.enum) && prop.enum.length > 0) {
          inputEl = createElement('select', { attrs: { id: `param_${name}` } });
          inputEl.appendChild(createElement('option', { text: '-- Select --', attrs: { value: '' } }));
          prop.enum.forEach((optionValue) => {
            inputEl.appendChild(createElement('option', {
              text: String(optionValue),
              attrs: { value: optionValue }
            }));
          });
        } else if (type === 'boolean') {
          inputEl = createElement('select', { attrs: { id: `param_${name}` } });
          inputEl.appendChild(createElement('option', { text: '-- Select --', attrs: { value: '' } }));
          inputEl.appendChild(createElement('option', { text: 'true', attrs: { value: 'true' } }));
          inputEl.appendChild(createElement('option', { text: 'false', attrs: { value: 'false' } }));
        } else if (type === 'array' || type === 'object') {
          inputEl = createElement('textarea', {
            attrs: {
              id: `param_${name}`,
              placeholder: prop.description || `${type} value as JSON`
            }
          });
        } else {
          inputEl = createElement('input', {
            attrs: {
              type: type === 'number' || type === 'integer' ? 'number' : 'text',
              id: `param_${name}`,
              placeholder: prop.description || ''
            }
          });
        }
        group.appendChild(inputEl);
        container.appendChild(group);
      });
    }
