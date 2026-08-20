// src/policy.js
// Loads approved-policies.json once at boot. Never let the model see raw
// file contents unfiltered — we shape a "safe read" object that only
// exposes values marked approved, and renders everything else as
// pending-owner-approval text so the model can't accidentally quote a
// null as if it were a real number.

const fs = require('fs');
const path = require('path');

const POLICY_PATH = path.join(__dirname, '..', 'config', 'approved-policies.json');

let _cache = null;

function loadRawPolicy() {
  const raw = fs.readFileSync(POLICY_PATH, 'utf8');
  return JSON.parse(raw);
}

function getPolicy() {
  if (!_cache) _cache = loadRawPolicy();
  return _cache;
}

function reloadPolicy() {
  _cache = loadRawPolicy();
  return _cache;
}

// Produces a plain-language block the model's system prompt can quote
// directly, so the model never has to interpret raw JSON status flags.
function getPolicySummaryForPrompt() {
  const p = getPolicy();

  const line = (label, entry, formatter) => {
    if (!entry) return `${label}: pending-owner-approval`;
    if (entry.status && entry.status !== 'approved' && entry.status !== 'language-only') {
      return `${label}: pending-owner-approval`;
    }
    return `${label}: ${formatter ? formatter(entry) : entry.value}`;
  };

  const tiers = p.vendor_commission_tiers && p.vendor_commission_tiers.status === 'approved'
    ? p.vendor_commission_tiers.tiers.map(t => `${t.name} ${t.commission}`).join(', ')
    : 'pending-owner-approval';

  return [
    line('Host service fee', p.host_service_fee),
    `Vendor commission tiers: ${tiers}`,
    line('Vendor plan pricing', p.vendor_plan_pricing),
    line('Checkout mode', p.checkout_mode),
    `Vendor payout: ${p.vendor_payout_trigger && p.vendor_payout_trigger.status === 'approved'
      ? `released when host marks event complete, or automatically after ${p.vendor_payout_trigger.auto_release_days} days if host takes no action. Never say vendors get an advance or deposit before the event.`
      : 'pending-owner-approval'}`,
    `Stripe required before vendor receives requests: ${p.stripe_required_for_requests.value === true ? 'yes' : 'pending-owner-approval'}`,
    `Marketplace size language: "${p.approved_marketplace_metrics.approved_public_language}" — never state exact vendor counts.`,
    `Suppressed claims (never say these): ${p.suppressed_claims.join('; ')}`,
    `Promotional offers (Elite/Bros Plus/VIP/founding-vendor discounts/free-year): not active unless this file is explicitly updated — never mention them.`,
  ].join('\n');
}

module.exports = { getPolicy, reloadPolicy, getPolicySummaryForPrompt };
