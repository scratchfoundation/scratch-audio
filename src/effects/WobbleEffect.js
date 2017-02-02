var Tone = require('tone');

/**
* A wobble effect. In audio terms, it sounds like tremolo.
* It is implemented using a low frequency oscillator (LFO) controlling
* a gain node, which causes the loudness of the signal passing through
* to increase and decrease rapidly.
* Effect value controls the wet/dry amount:
* 0 passes through none of the effect, 100 passes through all effect
* Effect value also controls the frequency of the LFO.
* Clamped 0 to 100
* @constructor
*/
function WobbleEffect () {
    Tone.Effect.call(this);

    this.value = 0;

    this.wobbleLFO = new Tone.LFO(10, 0, 1).start();
    this.wobbleGain = new Tone.Gain();
    this.wobbleLFO.connect(this.wobbleGain.gain);

    this.effectSend.chain(this.wobbleGain, this.effectReturn);
}

Tone.extend(WobbleEffect, Tone.Effect);

/**
* Set the effect value
* @param {number} val - the new value to set the effect to
*/
WobbleEffect.prototype.set = function (val) {
    this.value = val;

    this.value = this.clamp(this.value, 0, 100);

    this.wet.value = this.value / 100;

    this.wobbleLFO.frequency.rampTo(this.value / 10, 1/60);
};

/**
* Change the effect value
* @param {number} val - the value to change the effect by
*/
WobbleEffect.prototype.changeBy = function (val) {
    this.set(this.value + val);
};

/**
* Clamp the input to a range
* @param {number} input - the input to clamp
* @param {number} min - the min value to clamp to
* @param {number} max - the max value to clamp to
*/
WobbleEffect.prototype.clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = WobbleEffect;

