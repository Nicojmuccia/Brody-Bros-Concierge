const test = require('node:test');
const assert = require('node:assert');
const { getPolicySummaryForPrompt } = require('../src/policy');

test('policy summary never leaks a null as a real value', () => {
  const summary = getPolicySummaryForPrompt();
  assert.ok(!summary.includes('null'), 'summary should never render raw null');
  assert.ok(summary.includes('pending-owner-approval'), 'unapproved fields should read pending-owner-approval');
});

test('approved commission tiers appear verbatim', () => {
  const summary = getPolicySummaryForPrompt();
  assert.ok(summary.includes('Bros Connect 15%'));
  assert.ok(summary.includes('Bros Pro 10%'));
  assert.ok(summary.includes('Bros Premium 7%'));
});

test('suppressed claims are listed so the prompt can forbid them', () => {
  const summary = getPolicySummaryForPrompt();
  assert.ok(summary.toLowerCase().includes('35+ vendors'));
});
