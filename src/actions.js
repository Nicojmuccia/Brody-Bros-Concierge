// src/actions.js
// Executes ONLY the allowlisted action types from a validated response
// envelope. The model never gets to run arbitrary code or hit arbitrary
// URLs — OPEN_URL resolves through the server-owned public-links.json
// map by key, never a raw URL string from the model.

const publicLinks = require('../config/public-links.json');
const { sendHandoffNotification } = require('./notifications');
const { recordTranscriptEvent } = require('./transcript');

const ALLOWLISTED_ACTIONS = new Set([
  'OPEN_URL',
  'CREATE_SUPPORT_HANDOFF',
  'CREATE_BUSINESS_CONCIERGE_LEAD',
  'EMAIL_CONVERSATION_SUMMARY',
  'END_SESSION',
]);

async function executeAction(action, context) {
  if (!action || !ALLOWLISTED_ACTIONS.has(action.type)) {
    return { ok: false, reason: 'action_not_allowlisted' };
  }

  switch (action.type) {
    case 'OPEN_URL': {
      const url = publicLinks[action.url_key];
      if (!url) return { ok: false, reason: 'unknown_url_key' };
      return { ok: true, type: 'OPEN_URL', url, label: action.label || 'Continue' };
    }

    case 'CREATE_SUPPORT_HANDOFF':
    case 'CREATE_BUSINESS_CONCIERGE_LEAD': {
      const result = await sendHandoffNotification({
        kind: action.type,
        sessionId: context.sessionId,
        intent: context.intent,
        collectedFields: context.collectedFields || {},
        pageContext: context.pageContext || {},
        consentGiven: !!context.consentGiven,
      });
      recordTranscriptEvent(context.sessionId, 'handoff_created', { type: action.type });
      return { ok: result.ok, type: action.type, dedupeKey: result.dedupeKey };
    }

    case 'EMAIL_CONVERSATION_SUMMARY': {
      if (!context.consentGiven) {
        return { ok: false, reason: 'consent_required' };
      }
      const result = await sendHandoffNotification({
        kind: 'CONVERSATION_SUMMARY',
        sessionId: context.sessionId,
        intent: context.intent,
        collectedFields: context.collectedFields || {},
        pageContext: context.pageContext || {},
        consentGiven: true,
      });
      return { ok: result.ok, type: action.type };
    }

    case 'END_SESSION': {
      recordTranscriptEvent(context.sessionId, 'session_ended', {});
      return { ok: true, type: 'END_SESSION' };
    }

    default:
      return { ok: false, reason: 'unhandled_action' };
  }
}

module.exports = { executeAction, ALLOWLISTED_ACTIONS };
