    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text == null ? '' : String(text);
      return div.innerHTML;
    }

    function createElement(tag, options = {}) {
      const el = document.createElement(tag);
      if (options.className) el.className = options.className;
      if (options.text != null) el.textContent = options.text;
      if (options.attrs) {
        Object.entries(options.attrs).forEach(([key, value]) => {
          if (value != null) el.setAttribute(key, String(value));
        });
      }
      if (options.dataset) {
        Object.entries(options.dataset).forEach(([key, value]) => {
          if (value != null) el.dataset[key] = String(value);
        });
      }
      if (options.on) {
        Object.entries(options.on).forEach(([eventName, handler]) => {
          el.addEventListener(eventName, handler);
        });
      }
      return el;
    }

    function clearElement(node) {
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }
