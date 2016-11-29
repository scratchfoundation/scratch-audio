/*

A fuzz effect

Distortion

the value controls the wet/dry amount

Clamped 0-100

*/

var Tone = require('tone');

function FuzzEffect () {
    Tone.Effect.call(this);

    this.value = 0;

    this.distortion = new Tone.Distortion(1);

    this.effectSend.chain(this.distortion, this.effectReturn);
}

Tone.extend(FuzzEffect, Tone.Effect);

FuzzEffect.prototype.set = function (val) {
    this.value = val;

    this.value = this.clamp(this.value, 0, 100);

    this.distortion.wet.value = this.value / 100;
};

FuzzEffect.prototype.changeBy = function (val) {
    this.set(this.value + val);
};

FuzzEffect.prototype.clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = FuzzEffect;

