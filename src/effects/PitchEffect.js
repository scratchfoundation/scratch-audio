var Tone = require('tone');

/**
* A pitch change effect, which changes the playback rate of the sound in order
* to change its pitch: reducing the playback rate lowers the pitch, increasing the rate
* raises the pitch. The duration of the sound is also changed.
*
* Changing the value of the pitch effect by 10 causes a change in pitch by 1 semitone
* (i.e. a musical half-step, such as the difference between C and C#)
* Changing the pitch effect by 120 changes the pitch by one octave (12 semitones)
*
* The value of this effect is not clamped (i.e. it is typically between -120 and 120,
* but can be set much higher or much lower, with weird and fun results).
* We should consider what extreme values to use for clamping it.
*
* Note that this effect functions differently from the other audio effects. It is
* not part of a chain of audio nodes. Instead, it provides a way to set the playback
* on one SoundPlayer or a group of them.
* @constructor
*/
function PitchEffect () {
    this.value = 0; // effect value
    this.ratio = 1; // the playback rate ratio

    this.tone = new Tone();
}

/**
* Set the effect value
* @param {number} val - the new value to set the effect to
* @param {object} players - a dictionary of SoundPlayer objects to apply the effect to, indexed by md5
*/
PitchEffect.prototype.set = function (val, players) {
    this.value = val;
    this.ratio = this.getRatio(this.value);
    this.updatePlayers(players);
};

/**
* Change the effect value
* @param {number} val - the value to change the effect by
* @param {Object} players - a dictionary of SoundPlayer objects indexed by md5
*/
PitchEffect.prototype.changeBy = function (val, players) {
    this.set(this.value + val, players);
};

/**
* Compute the playback ratio for an effect value.
* The playback ratio is scaled so that a change of 10 in the effect value
* gives a change of 1 semitone in the ratio.
* @param {number} val - an effect value
* @returns {number} a playback ratio
*/
PitchEffect.prototype.getRatio = function (val) {
    return this.tone.intervalToFrequencyRatio(val / 10);
};

/**
* Update a sound player's playback rate using the current ratio for the effect
* @param {Object} player - a SoundPlayer object
*/
PitchEffect.prototype.updatePlayer = function (player) {
    player.setPlaybackRate(this.ratio);
};

/**
* Update a sound player's playback rate using the current ratio for the effect
* @param {object} players - a dictionary of SoundPlayer objects to update, indexed by md5
*/
PitchEffect.prototype.updatePlayers = function (players) {
    if (!players) return;

    for (var md5 in players) {
        if (players.hasOwnProperty(md5)) {
            this.updatePlayer(players[md5]);
        }
    }
};

module.exports = PitchEffect;

