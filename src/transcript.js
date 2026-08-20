// src/transcript.js
// Logs funnel/session events WITHOUT message content by default, per
// roadmap section 13 (analytics) and section 11 (no raw transcript
// storage without explicit consent + retention policy). Full transcript
// storage is opt-in and gated behind consentGiven — wire to a real store
// (Postgres/Supabase) before Phase 2; Phase 1 uses an in-memory array
// purely for local testing.

const events = []; // Phase 1 only — replace with durable storage before production.

function recordTranscriptEvent(sessionId, eventName, meta = {}) {
  events.push({
    session_id: sessionId,
    event: eventName,
    meta,
    at: new Date().toISOString(),
  });
}

// Only call this with explicit, logged consent. Even then, do not store
// sensitive fields (see validation.containsSensitiveField upstream).
function recordFullTranscript(sessionId, messages, { consentGiven }) {
  if (!consentGiven) {
    throw new Error('recordFullTranscript called without consentGiven=true');
  }
  recordTranscriptEvent(sessionId, 'full_transcript_stored', { messageCount: messages.length });
  // TODO Phase 2: persist to durable, access-controlled storage with a
  // defined retention/deletion window approved by the product owner.
}

function getEventsForSession(sessionId) {
  return events.filter(e => e.session_id === sessionId);
}

module.exports = { recordTranscriptEvent, recordFullTranscript, getEventsForSession };
