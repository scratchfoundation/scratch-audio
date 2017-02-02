var Tone = require('tone');

/**
* A fuzz effect (aka 'distortion effect' in audio terms)
* Effect value controls the wet/dry amount:
* 0 passes through none of the effect, 100 passes through all effect
* Clamped 0-100
* @constructor
*/
function FuzzEffect () {
    Tone.Effect.call(this);

    this.value = 0;

    this.distortion = new Tone.Distortion(1);

    this.effectSend.chain(this.distortion, this.effectReturn);
}

Tone.extend(FuzzEffect, Tone.Effect);

/**
* Set the effect value
* @param {number} val - the new value to set the effect to
*/
FuzzEffect.prototype.set = function (val) {
    this.value = val;

    this.value = this.clamp(this.value, 0, 100);

    this.distortion.wet.value = this.value / 100;
};

/**
* Change the effect value
* @param {number} val - the value to change the effect by
*/
FuzzEffect.prototype.changeBy = function (val) {
    this.set(this.value + val);
};

/**
* @param {number} input - the input to clamp
* @param {number} min - the min value to clamp to
* @param {number} max - the max value to clamp to
*/
FuzzEffect.prototype.clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = FuzzEffect;

