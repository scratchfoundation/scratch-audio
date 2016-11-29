/*

A Pan effect

-100 puts the audio on the left channel, 0 centers it, 100 makes puts it on the right.

Clamped -100 to 100

*/

var Tone = require('tone');

function PanEffect () {
    Tone.Effect.call(this);

    this.value = 0;

    this.panner = new Tone.Panner();

    this.effectSend.chain(this.panner, this.effectReturn);
}

Tone.extend(PanEffect, Tone.Effect);

PanEffect.prototype.set = function (val) {
    this.value = val;

    this.value = this.clamp(this.value, -100, 100);

    this.panner.pan.value = this.value / 100;
};

PanEffect.prototype.changeBy = function (val) {
    this.set(this.value + val);
};

PanEffect.prototype.clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = PanEffect;

