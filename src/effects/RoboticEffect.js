
var Tone = require('tone');

/**
* A "robotic" effect that adds a low-pitched buzzing to the sound, reminiscent of the
* voice of the daleks from Dr. Who.
* In audio terms it is a feedback comb filter with a short delay time.
* The effect value controls the length of this delay time, changing the pitch of the buzz
* A value of 0 mutes the effect.
* Other values change the pitch of the effect, in units of 10 steps per semitone.
* The effect value is not clamped (but probably should be).
* Exterminate.
* @constructor
*/
function RoboticEffect () {
    Tone.Effect.call(this);

    this.value = 0;

    var time = this._delayTimeForValue(100);
    this.feedbackCombFilter = new Tone.FeedbackCombFilter(time, 0.9);

    this.effectSend.chain(this.feedbackCombFilter, this.effectReturn);
}

Tone.extend(RoboticEffect, Tone.Effect);

/**
* Set the effect value
* @param {number} val - the new value to set the effect to
*/
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

/**
* Change the effect value
* @param {number} val - the value to change the effect by
*/
RoboticEffect.prototype.changeBy = function (val) {
    this.set(this.value + val);
};

/**
* Compute the delay time for an effect value.
* Convert the effect value to a musical note (in units of 10 per semitone),
* and return the period (single cycle duration) of the frequency of that note.
* @param {number} val - the effect value
* @returns {number} a delay time in seconds
*/
RoboticEffect.prototype._delayTimeForValue = function (val) {
    var midiNote = ((val - 100) / 10) + 36;
    var freq = Tone.Frequency(midiNote, 'midi').eval();
    return 1 / freq;
};

module.exports = RoboticEffect;

