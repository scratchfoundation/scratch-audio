/*

A wobble effect

A low frequency oscillator (LFO) controls a gain node
This creates an effect like tremolo

Clamped 0 to 100

*/

var Tone = require('tone');

function WobbleEffect () {
    Tone.Effect.call(this);

    this.value = 0;

    this.wobbleLFO = new Tone.LFO(10, 0, 1).start();
    this.wobbleGain = new Tone.Gain();
    this.wobbleLFO.connect(this.wobbleGain.gain);

    this.effectSend.chain(this.wobbleGain, this.effectReturn);
}

Tone.extend(WobbleEffect, Tone.Effect);

WobbleEffect.prototype.set = function (val) {
    this.value = val;

    this.value = this.clamp(this.value, 0, 100);

    this.wet.value = this.value / 100;

    this.wobbleLFO.frequency.rampTo(this.value / 10, 1/60);
};

WobbleEffect.prototype.changeBy = function (val) {
    this.set(this.value + val);
};

WobbleEffect.prototype.clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = WobbleEffect;

