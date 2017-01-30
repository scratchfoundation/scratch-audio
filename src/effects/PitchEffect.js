/*

A Pitch effect

*/

var Tone = require('tone');

function PitchEffect () {
    this.value = 0;
    this.ratio = 1;

    this.tone = new Tone();
}

PitchEffect.prototype.set = function (val, players) {
    this.value = val;
    this.ratio = this.getRatio(this.value);
    this.updatePlayers(players);
};

PitchEffect.prototype.changeBy = function (val, players) {
    this.set(this.value + val, players);
};

PitchEffect.prototype.getRatio = function (val) {
    return this.tone.intervalToFrequencyRatio(val / 10);
};

PitchEffect.prototype.updatePlayer = function (player) {
    player.setPlaybackRate(this.ratio);
};

PitchEffect.prototype.updatePlayers = function (players) {
    if (!players) return;

    for (var md5 in players) {
        this.updatePlayer(players[md5]);
    }
};



module.exports = PitchEffect;

