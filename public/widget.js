(function () {
  'use strict';

  // Session ID lives in memory for the page lifetime — no localStorage/
  // cookies required for Phase 1. Persisted only via server round-trip
  // (sessionId echoed back in each response) so it survives tab visibility
  // changes without ending the session.
  let sessionId = null;
  let hasOpenedOnce = false;

  const launcher = document.getElementById('brody-launcher');
  const tooltip = document.getElementById('brody-tooltip');
  const panel = document.getElementById('brody-panel');
  const closeBtn = document.getElementById('brody-close');
  const messagesEl = document.getElementById('brody-messages');
  const quickActionsEl = document.getElementById('brody-quick-actions');
  const form = document.getElementById('brody-form');
  const input = document.getElementById('brody-input');

  const OPENING_ACTIONS = [
    { label: 'Plan My Party', message: "I'm planning a party." },
    { label: 'Find Event Vendors', message: 'I want to find event vendors.' },
    { label: 'Become a Vendor', message: 'I want to become a vendor.' },
    { label: 'Finish Vendor Setup', message: 'I need to finish my vendor setup.' },
    { label: 'Check My Booking', message: 'I want to check my booking.' },
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

  function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `brody-msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderQuickActions(actions) {
    quickActionsEl.innerHTML = '';
    (actions || []).forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'brody-quick-btn';
      btn.textContent = a.label;
      btn.addEventListener('click', () => sendMessage(a.message));
      quickActionsEl.appendChild(btn);
    });
  }

  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    appendMessage('user', text);
    input.value = '';

    try {
      const res = await fetch('/api/chat', {
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
      appendMessage('assistant', data.reply);

      const openUrlAction = (data.suggested_actions || []).find(a => a.type === 'OPEN_URL' && a.url);
      if (openUrlAction) {
        const btn = document.createElement('button');
        btn.className = 'brody-quick-btn';
        btn.textContent = openUrlAction.label || 'Continue';
        btn.addEventListener('click', () => window.open(openUrlAction.url, '_blank', 'noopener'));
        quickActionsEl.innerHTML = '';
        quickActionsEl.appendChild(btn);
      }
    } catch (err) {
      appendMessage('assistant', "I'm having trouble connecting right now — please try again in a moment.");
    }
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    tooltip.hidden = true;
    if (!hasOpenedOnce) {
      hasOpenedOnce = true;
      appendMessage(
        'assistant',
        "Welcome to Party Bros! I'm Brody, your personal party concierge. Whether you're planning an event, searching for vendors, or growing your business as a vendor, I'll help you find the right next step. What brings you to the party?"
      );
      renderQuickActions(OPENING_ACTIONS);
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
