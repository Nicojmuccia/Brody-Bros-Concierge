// server.js — Bros AI Concierge backend (Phase 1 scaffold, NOT deployed)
// Isolated project. Does not touch Clawdia, Barnaby, Mia, or the Party
// Bros production app in any way. (Repo/package/internal id names remain
// "brody-concierge"/"brody-*" — the infrastructure identifier, not the
// visitor-facing brand name.)

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const { buildSystemPrompt } = require('./src/prompt');
const { classifyIntent } = require('./src/intent-router');
const { executeAction } = require('./src/actions');
const {
  validateIncomingChat,
  validateModelResponseEnvelope,
  containsSensitiveField,
} = require('./src/validation');
const { recordTranscriptEvent } = require('./src/transcript');
const { getPolicy } = require('./src/policy');

const app = express();
const PORT = process.env.PORT || 3000;
const PROMPT_VERSION = 'v2-bros-ai-concierge-aug2026';

// ---- Exact CORS allowlist (no substring matching) ----
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);
app.use(express.json({ limit: '100kb' })); // request body size limit
// The public static assets (embed.js, widget.js, widget.css) are loaded
// cross-origin by design — embed.js runs on the marketing site's domain
// and fetches these from this server's own domain. Helmet's default
// Cross-Origin-Resource-Policy is same-origin, which would silently block
// exactly that; scope a permissive override to just these three files
// rather than weakening it site-wide (the /api/chat route stays governed
// by the strict CORS allowlist above, untouched by this).
app.use(['/embed.js', '/widget.js', '/widget.css'], (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
app.use(express.static('public'));

// ---- Rate limiting ----
// Phase 1: in-memory limiter, fine for a single Railway instance during
// prototyping only. Before Phase 2 (multi-instance), swap to a durable
// store (e.g. rate-limit-redis) per roadmap section 11.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

// ---- Health check (no secrets, no internal config) ----
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    promptVersion: PROMPT_VERSION,
    policyVersion: getPolicy().policy_version,
  });
});

// ---- Widget entry point ----
app.get('/widget', (req, res) => {
  res.sendFile('widget.html', { root: 'public' });
});

// ---- Main chat endpoint ----
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { valid, errors } = validateIncomingChat(req.body);
  if (!valid) {
    return res.status(400).json({ error: 'invalid_request', details: errors });
  }

  const { messages, pageContext = {}, sessionId: incomingSessionId, consentGiven } = req.body;
  const sessionId = incomingSessionId || crypto.randomUUID();

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMessage && containsSensitiveField(lastUserMessage.content)) {
    recordTranscriptEvent(sessionId, 'sensitive_field_blocked', {});
    return res.json({
      reply:
        "For your safety, please don't share passwords, card numbers, bank details, ID numbers, or verification codes here. I can connect you with support if you need help with your account.",
      intent: 'security_block',
      suggested_actions: [{ type: 'CREATE_SUPPORT_HANDOFF', label: 'Contact support' }],
      sessionId,
    });
  }

  const preClassifiedIntent = classifyIntent(lastUserMessage ? lastUserMessage.content : '');

  const systemPrompt = buildSystemPrompt();

  // ---- Model call ----
  // Phase 1 placeholder: wire to Anthropic's Messages API (server-side
  // key only, never sent to the client). Structure shown for scaffolding;
  // fill in ANTHROPIC_API_KEY in .env before this is exercised for real.
  let modelEnvelope;
  try {
    modelEnvelope = await callModel({ systemPrompt, messages, pageContext, preClassifiedIntent });
  } catch (err) {
    console.error('[server] model call failed:', err.message);
    return res.status(200).json({
      reply:
        "I'm having trouble connecting right now. You can browse thebrosplatform.com directly, or reach the team at hello@thebrosplatform.com.",
      intent: 'fallback',
      suggested_actions: [],
      sessionId,
    });
  }

  const validation = validateModelResponseEnvelope(modelEnvelope);
  if (!validation.valid) {
    console.error('[server] model returned invalid envelope:', validation.errors);
    return res.status(200).json({
      reply: 'Let me get that from the team directly — one moment.',
      intent: 'fallback',
      suggested_actions: [{ type: 'CREATE_SUPPORT_HANDOFF', label: 'Contact support' }],
      sessionId,
    });
  }

  // Execute any allowlisted actions the model requested.
  const executedActions = [];
  for (const action of modelEnvelope.suggested_actions || []) {
    const result = await executeAction(action, {
      sessionId,
      intent: modelEnvelope.intent,
      collectedFields: modelEnvelope.collected_fields,
      pageContext,
      consentGiven,
    });
    executedActions.push(result);
  }

  recordTranscriptEvent(sessionId, 'chat_turn', { intent: modelEnvelope.intent });

  res.json({
    reply: modelEnvelope.reply,
    intent: modelEnvelope.intent,
    suggested_actions: executedActions,
    quick_replies: (modelEnvelope.quick_replies || []).slice(0, 3),
    sessionId,
    promptVersion: PROMPT_VERSION,
  });
});

// ---- Model call ----
// Matches the Clawdia/Barnaby/Mia fleet: OpenAI Chat Completions,
// gpt-4o-mini, server-side key only. Unlike Clawdia (free-text reply with
// a delimiter-marked data block parsed by regex), the Bros AI Concierge asks for a JSON
// object directly via response_format so the envelope can be schema-
// validated instead of regex-parsed — see src/validation.js.
const OPENAI_MODEL = 'gpt-4o-mini';

async function callModel({ systemPrompt, messages, pageContext, preClassifiedIntent }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set — see .env.example');
  }

  const envelopeInstructions = `
Respond with ONLY a single JSON object (no prose outside it, no markdown fences) matching this shape:
{
  "reply": "string shown to the visitor",
  "intent": "string, e.g. host_start_event, vendor_join, existing_booking, business_ai_concierge, unclassified",
  "confidence": 0.0,
  "collected_fields": {},
  "missing_fields": [],
  "suggested_actions": [
    { "type": "OPEN_URL", "label": "string", "url_key": "one of the approved url_keys" }
  ],
  "handoff_required": false,
  "handoff_reason": null,
  "quick_replies": ["string", "string"]
}
"quick_replies" is OPTIONAL and capped at 3 short (under ~6 words) natural next-step phrases the visitor could tap instead of typing, tailored to what they just asked (e.g. after a vendor-onboarding answer: "Check Stripe status", "Browse vendor categories" — not generic restatements of the 7 opening actions). Omit it entirely once the conversation is winding down or a handoff/URL action already covers the next step.
Page context: ${JSON.stringify(pageContext)}
Pre-classified intent hint (may be wrong, use your own judgment): ${preClassifiedIntent}
`.trim();

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${systemPrompt}\n\n${envelopeInstructions}` },
        ...messages,
      ],
    }),
  });

  const completion = await openaiResponse.json();

  if (!openaiResponse.ok) {
    console.error('[server] OpenAI API error:', completion);
    throw new Error('openai_api_error');
  }

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error('empty_model_response');

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('[server] failed to parse model JSON:', raw);
    throw new Error('unparseable_model_response');
  }
}

app.listen(PORT, () => {
  console.log(`Bros AI Concierge backend listening on port ${PORT} (prompt ${PROMPT_VERSION})`);
});

module.exports = app;
