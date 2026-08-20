// src/notifications.js
// Sends structured handoff/lead notifications to staff. Never emails a
// full raw transcript by default (per roadmap section 12). Uses
// STAFF_NOTIFICATION_EMAIL from env — never a hard-coded personal address.
//
// Phase 1: stub transport (console log). Swap in nodemailer/Resend once
// deploy config is approved — do not deploy yet per current instructions.

const crypto = require('crypto');
const escalationRules = require('../config/escalation-rules.json');

const recentDedupeKeys = new Map(); // key -> timestamp (in-memory; fine for single-instance Phase 1)

function buildDedupeKey({ sessionId, kind, intent }) {
  return crypto.createHash('sha256').update(`${sessionId}:${kind}:${intent}`).digest('hex');
}

function isDuplicate(dedupeKey) {
  const now = Date.now();
  const windowMs = escalationRules.duplicate_lead_window_minutes * 60 * 1000;
  const last = recentDedupeKeys.get(dedupeKey);
  if (last && now - last < windowMs) return true;
  recentDedupeKeys.set(dedupeKey, now);
  return false;
}

async function sendHandoffNotification({ kind, sessionId, intent, collectedFields, pageContext, consentGiven }) {
  const dedupeKey = buildDedupeKey({ sessionId, kind, intent });

  if (isDuplicate(dedupeKey)) {
    return { ok: true, deduped: true, dedupeKey };
  }

  const staffEmail = process.env.STAFF_NOTIFICATION_EMAIL;
  if (!staffEmail) {
    console.error('[notifications] STAFF_NOTIFICATION_EMAIL not set — cannot send handoff. Set it in your environment.');
    return { ok: false, reason: 'missing_staff_email', dedupeKey };
  }

  const record = {
    session_id: sessionId,
    created_at: new Date().toISOString(),
    source_page: pageContext.url || null,
    referrer: pageContext.referrer || null,
    intent,
    kind,
    collected_fields: redactSensitive(collectedFields),
    consent_given: consentGiven,
    status: 'new',
  };

  // Phase 1 stub — replace with real email transport before Phase 2.
  console.log(`[notifications] Would email ${staffEmail}:`, JSON.stringify(record, null, 2));

  return { ok: true, dedupeKey, record };
}

// Never forward raw values for fields that look like passwords, card
// numbers, SSNs, or verification codes, even if a user pasted them into
// a "collected field" some upstream logic didn't strip.
function redactSensitive(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    const lowerKey = key.toLowerCase();
    const isSensitiveKey = escalationRules.sensitive_field_blocklist.some(term => lowerKey.includes(term.split(' ')[0]));
    out[key] = isSensitiveKey ? '[redacted]' : value;
  }
  return out;
}

module.exports = { sendHandoffNotification };
