/*

A Reverb effect

The value controls the wet/dry amount of the effect

Clamped 0 to 100

*/

var Tone = require('tone');

function ReverbEffect () {
    Tone.Effect.call(this);

    this.value = 0;

    this.reverb = new Tone.Freeverb();

    this.effectSend.chain(this.reverb, this.effectReturn);
}

Tone.extend(ReverbEffect, Tone.Effect);

ReverbEffect.prototype.set = function (val) {
    this.value = val;

    this.value = this.clamp(this.value, 0, 100);

    this.reverb.wet.value = this.value / 100;
};

ReverbEffect.prototype.changeBy = function (val) {
    this.set(this.value + val);
};

ReverbEffect.prototype.clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = ReverbEffect;

