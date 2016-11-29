/*

A robot-voice effect

A feedback comb filter with a short delay time creates a low-pitched buzzing
The effect value controls the length of this delay time, changing the pitch

0 mutes the effect

Other values changes the pitch of the effect, in units of 10 steps per semitone

Not clamped

*/

var Tone = require('tone');

function RoboticEffect () {
    Tone.Effect.call(this);

    this.value = 0;

    var time = this._delayTimeForValue(100);
    this.feedbackCombFilter = new Tone.FeedbackCombFilter(time, 0.9);

    this.effectSend.chain(this.feedbackCombFilter, this.effectReturn);
}

Tone.extend(RoboticEffect, Tone.Effect);

RoboticEffect.prototype.set = function (val) {
    this.value = val;

    // mute the effect if value is 0
    if (this.value == 0) {
        this.wet.value = 0;
    } else {
        this.wet.value = 1;
    }

    // set delay time using the value
    var time = this._delayTimeForValue(this.value);
    this.feedbackCombFilter.delayTime.rampTo(time, 1/60);
};

RoboticEffect.prototype.changeBy = function (val) {
    this.set(this.value + val);
};

RoboticEffect.prototype._delayTimeForValue = function (val) {
    // convert effect setting range, typically 0-100 but can be outside that,
    // to a musical note, and return the period of the frequency of that note
    var midiNote = ((val - 100) / 10) + 36;
    var freq = Tone.Frequency(midiNote, 'midi').eval();
    return 1 / freq;
};

module.exports = RoboticEffect;

