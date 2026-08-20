const test = require('node:test');
const assert = require('node:assert');
const { classifyIntent } = require('../src/intent-router');

test('classifies a host planning message', () => {
  assert.strictEqual(classifyIntent("I'm planning a 40th birthday party"), 'host_start_event');
});

test('classifies a vendor-browsing message', () => {
  assert.strictEqual(classifyIntent('I want to find a vendor for a wedding'), 'host_browse_vendors');
});
