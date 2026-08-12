import assert from "node:assert/strict";
import { CardPool, isCloseHit } from "../v2/src/card-pool.js";
import { cycleDuration, phaseAt } from "../v2/src/timeline.js";

assert.equal(cycleDuration, 78);
assert.equal(phaseAt(0).phase.key, "slow");
assert.equal(phaseAt(20).phase.key, "silence-1");
assert.equal(phaseAt(26).phase.key, "medium");
assert.equal(phaseAt(46).phase.key, "silence-2");
assert.equal(phaseAt(52).phase.key, "overload");
assert.equal(phaseAt(72).phase.key, "silence-3");
assert.equal(phaseAt(78).phase.key, "slow");

assert.equal(isCloseHit({ x: 0.9, y: 0.9 }), true);
assert.equal(isCloseHit({ x: 0.79, y: 0.9 }), false);
assert.equal(isCloseHit({ x: 0.9, y: 0.69 }), false);

const pool = Object.create(CardPool.prototype);
pool.max = 72;
pool.active = new Set(
  Array.from({ length: 71 }, (_, index) => ({
    bornAt: index,
    hoveredBy: new Set(),
    paused: false,
  })),
);
pool.release = function release(slot) {
  this.active.delete(slot);
};
pool.makeSpace(2);
assert.equal(pool.size, 70);
assert.equal(pool.size + 2, 72);

const replacementPool = Object.create(CardPool.prototype);
replacementPool.max = 72;
replacementPool.active = new Set(
  Array.from({ length: 71 }, () => ({ hoveredBy: new Set(), paused: false, active: true })),
);
replacementPool.release = function release(slot) {
  slot.active = false;
  this.active.delete(slot);
};
replacementPool.prepareReplacement(null, 1);
assert.equal(replacementPool.size, 70);

console.log("V2-Tests bestanden");
