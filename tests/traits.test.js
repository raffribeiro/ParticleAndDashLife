import test from 'node:test';import assert from 'node:assert/strict';
import {ensureTraits,inheritTraits,reproductionRules} from '../dist/traits.js';
test('hunter and evasive profiles have distinct reproductive tradeoffs',()=>{const h={id:1},e={id:2};ensureTraits(h);ensureTraits(e);assert.ok(h.traits.hunt>e.traits.hunt);assert.ok(h.traits.escape<e.traits.escape);assert.ok(reproductionRules(e).cooldown<reproductionRules(h).cooldown);});
test('offspring inherit specialization with bounded variation',()=>{const a={id:1};ensureTraits(a);const child=inheritTraits(a,()=>.75);assert.ok(Math.abs(child.hunt-a.traits.hunt)<.1);assert.ok(child.hunt<=1&&child.hunt>=0);});
