var SoundPlayer = require('./SoundPlayer');
var Tone = require('tone');

function DrumPlayer (outputNode) {
    this.outputNode = outputNode;

    this.snare = new SoundPlayer(this.outputNode);
    var snareUrl = 'https://raw.githubusercontent.com/LLK/scratch-audio/develop/sound-files/drums/SnareDrum(1)_22k.wav';
    this.snare.setBuffer(new Tone.Buffer(snareUrl));
}

DrumPlayer.prototype.start = function () {
    this.snare.start();
};

module.exports = DrumPlayer;
