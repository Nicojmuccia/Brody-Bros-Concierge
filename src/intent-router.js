// src/intent-router.js
// Lightweight keyword/heuristic pre-classifier. This does NOT replace the
// model's own intent field in its structured output — it's a cheap first
// pass used to (a) pick which quick-action buttons to show and (b) sanity
// check the model's self-reported intent against obvious signals before
// we trust it for routing-sensitive actions like OPEN_URL.

const INTENT_RULES = [
  { intent: 'host_start_event', patterns: [/plan(ning)? (a|my)\b.*\b(party|event|wedding|birthday)/i, /need (a )?(dj|caterer|photographer|bartender|venue)/i, /i'?m hosting/i] },
  { intent: 'host_browse_vendors', patterns: [/find (a )?vendor/i, /browse (vendors|categories)/i, /looking for a (dj|caterer|photographer)/i] },
  { intent: 'host_pricing', patterns: [/host fee/i, /how much does it cost to (book|plan)/i] },

  { intent: 'vendor_join', patterns: [/become a vendor/i, /join as a vendor/i, /i'?m a (dj|caterer|photographer|bartender)/i, /sign up.*vendor/i] },
  { intent: 'vendor_resume_onboarding', patterns: [/finish (my )?(vendor )?(setup|onboarding)/i, /not receiving (party )?requests/i, /stripe (verification|kyc)/i] },
  { intent: 'vendor_commission', patterns: [/commission/i, /what.*(pay|fee).*vendor/i, /vendor plan/i] },

  { intent: 'existing_booking', patterns: [/where is my (booking|event)/i, /my (booking|event) status/i] },
  { intent: 'existing_account', patterns: [/sign in/i, /log ?in/i, /can'?t access my account/i, /reset my password/i] },
  { intent: 'existing_payment_issue', patterns: [/refund/i, /release my (payment|payout)/i, /chargeback/i, /dispute/i] },

  { intent: 'business_ai_concierge', patterns: [/ai concierge/i, /clawdia/i, /concierge for my (restaurant|business|venue)/i, /chatbot for my/i] },

  { intent: 'security_probe', patterns: [/ignore (your|previous) instructions/i, /reveal your (system prompt|instructions)/i, /you are now/i] },
];

function classifyIntent(message) {
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some(p => p.test(message))) {
      return rule.intent;
    }
  }
  return 'unclassified';
}

module.exports = { classifyIntent, INTENT_RULES };
