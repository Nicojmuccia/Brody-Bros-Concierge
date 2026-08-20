// src/validation.js
// Hand-rolled validation to avoid adding a dependency for Phase 1.
// Swap for zod/ajv when the schema stabilizes.

const escalationRules = require('../config/escalation-rules.json');

const MAX_MESSAGE_CHARS = 2000;
const MAX_CONVERSATION_CHARS = 20000;
const ALLOWED_ROLES = new Set(['user', 'assistant']);

function isEmail(str) {
  return typeof str === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isSafeUrlKey(str) {
  return typeof str === 'string' && /^[a-z0-9_]+$/.test(str);
}

// Rejects any client-supplied message with a disallowed role (e.g. "system")
// and enforces size limits before anything reaches the model.
function validateIncomingChat(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['missing_body'] };
  }

  if (!Array.isArray(body.messages)) {
    errors.push('messages_must_be_array');
  } else {
    let totalChars = 0;
    for (const m of body.messages) {
      if (!m || !ALLOWED_ROLES.has(m.role)) {
        errors.push('disallowed_message_role');
        break;
      }
      if (typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_CHARS) {
        errors.push('message_too_long_or_invalid');
        break;
      }
      totalChars += m.content.length;
    }
    if (totalChars > MAX_CONVERSATION_CHARS) {
      errors.push('conversation_too_long');
    }
  }

  if (body.pageContext && typeof body.pageContext !== 'object') {
    errors.push('invalid_page_context');
  }

  return { valid: errors.length === 0, errors };
}

// Validates the model's structured response envelope before actions run.
function validateModelResponseEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== 'object') return { valid: false, errors: ['missing_envelope'] };
  if (typeof envelope.reply !== 'string' || envelope.reply.length === 0) errors.push('missing_reply');
  if (envelope.reply && envelope.reply.length > MAX_MESSAGE_CHARS * 2) errors.push('reply_too_long');

  if (envelope.suggested_actions) {
    if (!Array.isArray(envelope.suggested_actions)) {
      errors.push('suggested_actions_must_be_array');
    } else {
      for (const action of envelope.suggested_actions) {
        if (action.type === 'OPEN_URL' && !isSafeUrlKey(action.url_key)) {
          errors.push('invalid_url_key');
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Screens free-text for sensitive fields Brody must never collect
// (passwords, SSNs, card numbers, verification codes, etc).
function containsSensitiveField(text) {
  if (typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return escalationRules.sensitive_field_blocklist.some(term => lower.includes(term));
}

function validateContactField({ email, phone }) {
  const errors = [];
  if (email && !isEmail(email)) errors.push('invalid_email');
  if (phone && !/^[\d\s()+\-.]{7,20}$/.test(phone)) errors.push('invalid_phone');
  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateIncomingChat,
  validateModelResponseEnvelope,
  containsSensitiveField,
  validateContactField,
  MAX_MESSAGE_CHARS,
  MAX_CONVERSATION_CHARS,
};
