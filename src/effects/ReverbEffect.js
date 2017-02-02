var Tone = require('tone');

/**
* A reverb effect, simulating reverberation in a room
* Effect value controls the wet/dry amount:
* 0 passes through none of the effect, 100 passes through all effect
* Clamped 0 to 100
* @constructor
*/
function ReverbEffect () {
    Tone.Effect.call(this);

    this.value = 0;

    this.reverb = new Tone.Freeverb();

    this.effectSend.chain(this.reverb, this.effectReturn);
}

Tone.extend(ReverbEffect, Tone.Effect);

/**
* Set the effect value
* @param {number} val - the new value to set the effect to
*/
ReverbEffect.prototype.set = function (val) {
    this.value = val;

    this.value = this.clamp(this.value, 0, 100);

    this.reverb.wet.value = this.value / 100;
};

/**
* Change the effect value
* @param {number} val - the value to change the effect by
*/
ReverbEffect.prototype.changeBy = function (val) {
    this.set(this.value + val);
};

/**
* Clamp the input to a range
* @param {number} input - the input to clamp
* @param {number} min - the min value to clamp to
* @param {number} max - the max value to clamp to
*/
ReverbEffect.prototype.clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = ReverbEffect;

