// src/knowledge.js
// Versioned, approved static facts — descriptive/product info that isn't
// policy-sensitive pricing. Each fact carries provenance so it can be
// audited and refreshed without touching prompt.js.
//
// IMPORTANT: this is a placeholder seed set for Phase 1 scaffolding.
// Before Phase 2 (public install), replace with an admin-reviewed export
// and wire fact_id / approved_by / expires_at into a real review cadence.

const APPROVED_FACTS = [
  {
    fact_id: 'what-is-party-bros',
    topic: 'general',
    answer:
      "Party Bros is The Bros Platform's AI-powered event planning marketplace. Hosts describe their event and get matched with vetted local vendors — DJs, caterers, photographers, venues, bartenders, and more. One message, an entire party.",
    source_url: 'https://thebrosplatform.com',
    approved_by: 'pending-owner-approval',
    approved_at: null,
    review_date: null,
  },
  {
    fact_id: 'how-matching-works',
    topic: 'host',
    answer:
      "Once a host describes their event in the Party Builder, Party Bros surfaces vendors that match the category, location, and date. Vendors then respond with offers the host can compare. Brody can't guarantee how many vendors will respond or what they'll charge.",
    source_url: 'https://thebrosplatform.com/how-it-works',
    approved_by: 'pending-owner-approval',
    approved_at: null,
    review_date: null,
  },
  {
    fact_id: 'vendor-onboarding-steps',
    topic: 'vendor',
    answer:
      'Becoming a Party Bros vendor involves: creating an account, verifying your email, completing Stripe identity verification, building your vendor profile, creating a service listing with pricing and availability, and publishing it. Stripe verification must be complete before you can receive host requests.',
    source_url: 'https://thebrosplatform.com/vendors/join',
    approved_by: 'pending-owner-approval',
    approved_at: null,
    review_date: null,
  },
  {
    fact_id: 'founder-story',
    topic: 'general',
    answer:
      'Party Bros was founded in New Jersey out of firsthand experience in the local hospitality and events industry, aiming to make finding trustworthy event vendors as easy as calling a friend.',
    source_url: 'https://thebrosplatform.com/about',
    approved_by: 'pending-owner-approval',
    approved_at: null,
    review_date: null,
  },
  {
    fact_id: 'ai-concierge-overview',
    topic: 'business_prospect',
    answer:
      "Bros AI Concierge is Party Bros' AI-employee product for local businesses — a branded chat concierge that handles FAQs, bookings/reservations, and lead capture, built on the same engine that powers Party Bros. Details and demos are handled through a qualified sales conversation, not public chat pricing quotes.",
    source_url: null,
    approved_by: 'pending-owner-approval',
    approved_at: null,
    review_date: null,
  },
];

function findFactsByTopic(topic) {
  return APPROVED_FACTS.filter(f => f.topic === topic || f.topic === 'general');
}

function getAllFacts() {
  return APPROVED_FACTS;
}

// Renders a compact block for the system prompt so the model quotes from
// this instead of inventing marketing claims.
function getKnowledgeSummaryForPrompt() {
  return APPROVED_FACTS.map(f => `- (${f.fact_id}) ${f.answer}`).join('\n');
}

module.exports = { findFactsByTopic, getAllFacts, getKnowledgeSummaryForPrompt, APPROVED_FACTS };
