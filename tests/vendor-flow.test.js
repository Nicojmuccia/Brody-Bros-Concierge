const test = require('node:test');
const assert = require('node:assert');
const { classifyIntent } = require('../src/intent-router');

test('classifies a vendor join message', () => {
  assert.strictEqual(classifyIntent('I want to become a vendor'), 'vendor_join');
});

test('classifies a stripe/onboarding resume message', () => {
  assert.strictEqual(classifyIntent("I'm not receiving party requests"), 'vendor_resume_onboarding');
});
