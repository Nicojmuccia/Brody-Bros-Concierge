(function () {
  'use strict';

  // When loaded directly as /widget on the concierge's own domain, relative
  // URLs work fine. When injected into another site via embed.js, embed.js
  // sets window.__BRODY_API_BASE__ to that domain's own origin so /api/chat
  // still resolves correctly cross-origin. (Internal variable/id names kept
  // as "brody" — that's the codebase/project identifier, not the brand the
  // visitor sees; renaming every internal id risked destabilizing a working
  // deploy for no visitor-facing benefit.)
  const API_BASE = window.__BRODY_API_BASE__ || '';

  let sessionId = null;
  let hasOpenedOnce = false;
  let hasSentFirstMessage = false;
  let requestInFlight = false;

  const launcher = document.getElementById('brody-launcher');
  const tooltip = document.getElementById('brody-tooltip');
  const panel = document.getElementById('brody-panel');
  const closeBtn = document.getElementById('brody-close');
  const messagesEl = document.getElementById('brody-messages');
  const quickActionsEl = document.getElementById('brody-quick-actions');
  const form = document.getElementById('brody-form');
  const input = document.getElementById('brody-input');
  const sendBtn = document.getElementById('brody-send');

  const OPENING_ACTIONS = [
    { label: 'Plan My Party', message: "I'm planning a party." },
    { label: 'Find Vendors', message: 'I want to find vendors.' },
    { label: 'Become a Vendor', message: 'I want to become a vendor.' },
    { label: 'Manage My Booking', message: 'I want to manage my booking.' },
    { label: 'How Party Bros Works', message: 'How does Party Bros work?' },
    { label: 'Get Support', message: 'I need support.' },
  ];

  function getPageContext() {
    return {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer || null,
    };
  }

  // The branded AI orb — an inline SVG emblem, never an external image, so
  // there's no file to go missing or fail to load. A slow, subtle rotation
  // on the inner spark gives it the "animated AI orb" feel without being
  // distracting or constantly bouncing.
  function orbMarkup(sizeClass) {
    return (
      '<svg class="brody-orb-svg ' + (sizeClass || '') + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><radialGradient id="brodyOrbGrad" cx="35%" cy="30%" r="75%">' +
      '<stop offset="0%" stop-color="#6fa8ff"/><stop offset="55%" stop-color="#1c5cff"/><stop offset="100%" stop-color="#0b2559"/>' +
      '</radialGradient></defs>' +
      '<circle cx="50" cy="50" r="48" fill="url(#brodyOrbGrad)"/>' +
      '<path class="brody-orb-spark" d="M50 26 L57 43 L74 50 L57 57 L50 74 L43 57 L26 50 L43 43 Z" fill="#ffffff" opacity="0.92"/>' +
      '</svg>'
    );
  }

  function appendUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'brody-msg user';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Assistant messages render inside a row with the concierge's small orb
  // avatar beside the bubble.
  function appendAssistantMessage(text) {
    const row = document.createElement('div');
    row.className = 'brody-msg-row';

    const avatar = document.createElement('div');
    avatar.className = 'brody-msg-avatar';
    avatar.innerHTML = orbMarkup('brody-orb-sm');

    const bubble = document.createElement('div');
    bubble.className = 'brody-msg assistant';
    bubble.textContent = text;

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'brody-typing-row';
    row.id = 'brody-typing-row';

    const avatar = document.createElement('div');
    avatar.className = 'brody-msg-avatar';
    avatar.innerHTML = orbMarkup('brody-orb-sm');

    const bubble = document.createElement('div');
    bubble.className = 'brody-typing-bubble';
    bubble.setAttribute('aria-label', 'Bros AI is typing');
    bubble.innerHTML = '<span></span><span></span><span></span>';

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTypingIndicator() {
    const row = document.getElementById('brody-typing-row');
    if (row) row.remove();
  }

  function setInputDisabled(disabled) {
    requestInFlight = disabled;
    input.disabled = disabled;
    sendBtn.disabled = disabled;
  }

  // Opening actions only ever show before the visitor's first message.
  // After that, quick actions come from the server's per-turn quick_replies
  // (capped at 3) so they stay relevant to what was just said.
  function renderOpeningActions() {
    quickActionsEl.innerHTML = '';
    OPENING_ACTIONS.forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'brody-quick-btn';
      btn.textContent = a.label;
      btn.addEventListener('click', () => sendMessage(a.message));
      quickActionsEl.appendChild(btn);
    });
  }

  function renderQuickReplies(quickReplies, openUrlAction) {
    quickActionsEl.innerHTML = '';
    (quickReplies || []).slice(0, 3).forEach(text => {
      const btn = document.createElement('button');
      btn.className = 'brody-quick-btn';
      btn.textContent = text;
      btn.addEventListener('click', () => sendMessage(text));
      quickActionsEl.appendChild(btn);
    });
    if (openUrlAction) {
      const btn = document.createElement('button');
      btn.className = 'brody-quick-btn';
      btn.textContent = openUrlAction.label || 'Continue';
      btn.addEventListener('click', () => window.open(openUrlAction.url, '_blank', 'noopener'));
      quickActionsEl.appendChild(btn);
    }
  }

  async function sendMessage(text) {
    if (!text || !text.trim() || requestInFlight) return;

    hasSentFirstMessage = true;
    appendUserMessage(text);
    input.value = '';
    setInputDisabled(true);
    showTypingIndicator();

    try {
      const res = await fetch(API_BASE + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          pageContext: getPageContext(),
          sessionId,
        }),
      });
      const data = await res.json();
      sessionId = data.sessionId || sessionId;

      hideTypingIndicator();
      appendAssistantMessage(data.reply);

      const openUrlAction = (data.suggested_actions || []).find(a => a.type === 'OPEN_URL' && a.url);
      renderQuickReplies(data.quick_replies, openUrlAction);
    } catch (err) {
      hideTypingIndicator();
      appendAssistantMessage("I'm having trouble connecting right now — please try again in a moment.");
    } finally {
      setInputDisabled(false);
      input.focus();
    }
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    tooltip.hidden = true;
    if (!hasOpenedOnce) {
      hasOpenedOnce = true;
      appendAssistantMessage(
        "Welcome to Party Bros! I'm the Bros AI Concierge. I can help you plan an event, find the right vendors, manage a booking, or grow your business on Party Bros. What brings you to the party?"
      );
      if (!hasSentFirstMessage) renderOpeningActions();
    }
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
  }

  launcher.addEventListener('click', () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });
  closeBtn.addEventListener('click', closePanel);

  form.addEventListener('submit', e => {
    e.preventDefault();
    sendMessage(input.value);
  });

  // Do NOT end the session on tab visibility change — sessionId persists
  // in memory for the page's lifetime regardless of tab focus.
  document.addEventListener('visibilitychange', () => {
    // Intentionally a no-op. Kept explicit so future edits don't
    // accidentally add a session-reset here.
  });

  // Hide the first-visit tooltip after a delay if untouched.
  setTimeout(() => { if (tooltip) tooltip.hidden = true; }, 8000);
})();
