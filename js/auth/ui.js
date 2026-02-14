    // ============================================
    // Auth UI Functions
    // ============================================
    function showAuthModal(authInfo) {
      const modal = document.getElementById('authModal');
      const infoEl = document.getElementById('authInfo');
      const oauthSection = document.getElementById('oauthSection');
      const oauthSectionTitle = document.getElementById('oauthSectionTitle');
      const oauthContent = document.getElementById('oauthContent');
      const firstPartySection = document.getElementById('firstPartySection');
      const skipAuthSection = document.getElementById('skipAuthSection');

      // Reset all forms and selections
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      document.querySelectorAll('.auth-option').forEach(o => o.classList.remove('selected'));
      infoEl.style.display = 'none';

      // Reset all sections to hidden first
      oauthSection.style.display = 'none';
      firstPartySection.style.display = 'none';
      skipAuthSection.style.display = 'block'; // Always show skip option

      // Determine OAuth configuration
      const hasOAuth = authInfo.type === 'oauth' && authInfo.meta?.authorization_endpoint;
      const hasThirdPartyIdps = authInfo.thirdParty && authInfo.thirdParty.length > 0;

      clearElement(oauthContent);

      if (hasOAuth) {
        // Show OAuth section prominently
        oauthSection.style.display = 'block';

        if (hasThirdPartyIdps) {
          // Multiple IdPs available - also show manual auth as fallback
          oauthSectionTitle.textContent = 'Sign in with';
          const idpGrid = createElement('div', { className: 'idp-grid' });
          authInfo.thirdParty.forEach((idp) => {
            const idpBtn = createElement('button', {
              className: 'idp-btn',
              attrs: { type: 'button' },
              on: { click: () => startOAuth(idp) }
            });
            const iconWrapper = createElement('span');
            iconWrapper.innerHTML = getIdpIcon(idp);
            idpBtn.appendChild(iconWrapper);
            idpBtn.appendChild(createElement('span', { text: formatIdpName(idp) }));
            idpGrid.appendChild(idpBtn);
          });
          oauthContent.appendChild(idpGrid);
          // Show manual auth as alternative
          firstPartySection.style.display = 'block';
        } else {
          // Server is its own OAuth provider (like PayPal)
          const serverName = getServerName(serverUrl);
          oauthSectionTitle.textContent = 'Sign in with ' + serverName;
          const oauthBtn = createElement('button', {
            className: 'btn btn-primary',
            attrs: {
              type: 'button',
              style: 'width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;'
            },
            on: { click: () => startOAuth() }
          });
          const iconWrapper = createElement('span');
          iconWrapper.innerHTML = getServerIcon(serverUrl);
          oauthBtn.appendChild(iconWrapper);
          oauthBtn.appendChild(createElement('span', { text: `Continue with ${serverName}` }));
          oauthContent.appendChild(oauthBtn);

          oauthContent.appendChild(createElement('div', {
            text: `You'll be redirected to ${serverName} to authenticate.`,
            attrs: { style: 'margin-top: 12px; font-size: 12px; color: var(--text-secondary);' }
          }));
          // Hide manual auth - OAuth is the only option
          firstPartySection.style.display = 'none';
        }

        // Show info about OAuth support
        if (authInfo.supportsRegistration) {
          infoEl.style.display = 'block';
          infoEl.className = 'auth-info success';
          infoEl.textContent = 'This server supports OAuth with automatic client registration.';
        }
      } else {
        // No OAuth - show manual authentication options
        oauthSection.style.display = 'none';
        firstPartySection.style.display = 'block';
      }

      modal.classList.add('active');
    }

    function getServerName(url) {
      try {
        const hostname = new URL(url).hostname;
        // Extract readable name from hostname
        const parts = hostname.split('.');
        if (parts.length >= 2) {
          // mcp.paypal.com -> PayPal
          const name = parts[parts.length - 2];
          return name.charAt(0).toUpperCase() + name.slice(1);
        }
        return hostname;
      } catch {
        return 'Server';
      }
    }

    function getServerIcon(url) {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes('paypal')) {
          return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.641.641 0 0 1 .632-.54h6.012c2.657 0 4.527.856 5.432 2.479.398.715.621 1.502.667 2.347.05.9-.058 1.925-.32 3.044-.332 1.418-.863 2.615-1.58 3.556-.67.877-1.502 1.584-2.474 2.1-.923.493-1.943.752-3.034.77H8.074a.641.641 0 0 0-.632.54l-.366 2.32z"/></svg>';
        }
        if (hostname.includes('github')) {
          return getIdpIcon('github');
        }
        if (hostname.includes('google')) {
          return getIdpIcon('google');
        }
        // Default icon
        return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';
      } catch {
        return '';
      }
    }

    async function startOAuth(idp = null) {
      try {
        const infoEl = document.getElementById('authInfo');
        infoEl.style.display = 'block';
        infoEl.className = 'auth-info';
        infoEl.textContent = 'Redirecting to login...';

        await auth.startOAuthFlow(idp);
      } catch (error) {
        const infoEl = document.getElementById('authInfo');
        infoEl.style.display = 'block';
        infoEl.className = 'auth-info error';
        infoEl.textContent = `Error: ${error.message}`;
      }
    }

    function closeAuthModal() {
      document.getElementById('authModal').classList.remove('active');
    }

    function handleAuthTypeKeydown(event, type) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectAuthType(event, type);
      }
    }

    function selectAuthType(event, type) {
      // Update selection UI
      document.querySelectorAll('.auth-option').forEach(o => o.classList.remove('selected'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

      if (event?.currentTarget) {
        event.currentTarget.classList.add('selected');
      }
      document.getElementById(`${type}Form`).classList.add('active');
    }

    async function submitApiKey() {
      const apiKey = document.getElementById('apiKeyInput').value.trim();
      if (!apiKey) return;

      auth.setApiKey(apiKey);
      closeAuthModal();
      updateAuthBadge();
      await proceedWithConnection();
    }

    async function submitBasicAuth() {
      const username = document.getElementById('basicUsername').value.trim();
      const password = document.getElementById('basicPassword').value;
      if (!username || !password) return;

      auth.setBasicAuth(username, password);
      closeAuthModal();
      updateAuthBadge();
      await proceedWithConnection();
    }

    async function submitBearerToken() {
      const token = document.getElementById('bearerTokenInput').value.trim();
      if (!token) return;

      auth.setBearerToken(token);
      closeAuthModal();
      updateAuthBadge();
      await proceedWithConnection();
    }

    async function skipAuth() {
      closeAuthModal();
      await proceedWithConnection();
    }

    function updateAuthBadge() {
      const badge = document.getElementById('authBadge');
      if (auth && auth.isAuthenticated()) {
        badge.innerHTML = `<span class="auth-badge authenticated">Authenticated</span>`;
      } else {
        badge.innerHTML = '';
      }
    }

    function getIdpIcon(idp) {
      const icons = {
        google: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
        github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
        microsoft: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/></svg>',
        okta: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
        auth0: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.98 7.448L19.62 0H4.347L2.02 7.448c-1.352 4.312.03 9.206 3.815 12.015L12.007 24l6.157-4.552c3.755-2.81 5.182-7.688 3.815-12.015l-6.16 4.58 2.343 7.45-6.157-4.597-6.158 4.58 2.358-7.433-6.188-4.55 7.63-.045L12.008 0l2.356 7.404 7.615.044z"/></svg>'
      };

      const idpLower = idp.toLowerCase();
      return icons[idpLower] || '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>';
    }

    function formatIdpName(idp) {
      const names = {
        google: 'Google',
        github: 'GitHub',
        microsoft: 'Microsoft',
        okta: 'Okta',
        auth0: 'Auth0',
        azure: 'Azure AD',
        facebook: 'Facebook'
      };
      return names[idp.toLowerCase()] || idp.charAt(0).toUpperCase() + idp.slice(1);
    }

