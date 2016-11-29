/*

A Pitch effect

*/

var Tone = require('tone');

function PitchEffect () {
     this.value = 0;

     this.tone = new Tone();
}

PitchEffect.prototype.set = function (val, players) {
    this.value = val;
    this.updatePlayers(players);
};

PitchEffect.prototype.changeBy = function (val, players) {
    this.set(this.value + val, players);
};

PitchEffect.prototype.getRatio = function () {
    return this.tone.intervalToFrequencyRatio(this.value / 10);
};

PitchEffect.prototype.updatePlayers = function (players) {
    if (!players) return;

    var ratio = this.getRatio();
    for (var i=0; i<players.length; i++) {
        players[i].setPlaybackRate(ratio);
    }

};

module.exports = PitchEffect;

