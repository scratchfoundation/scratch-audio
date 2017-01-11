var SoundPlayer = require('./SoundPlayer');
var Tone = require('tone');

function DrumPlayer (outputNode) {
    this.outputNode = outputNode;

    var baseUrl = 'https://raw.githubusercontent.com/LLK/scratch-audio/develop/sound-files/drums/';
    var fileNames = [
        'SnareDrum(1)',
        'BassDrum(1b)',
        'SideStick(1)',
        'Crash(2)',
        'HiHatOpen(2)',
        'HiHatClosed(1)',
        'Tambourine(3)',
        'Clap(1)',
        'Claves(1)',
        'WoodBlock(1)',
        'Cowbell(3)',
        'Triangle(1)',
        'Bongo',
        'Conga(1)',
        'Cabasa(1)',
        'GuiroLong(1)',
        'Vibraslap(1)',
        'Cuica(2)'
    ];

    this.drumSounds = [];

    for (var i=0; i<fileNames.length; i++) {
        var url = baseUrl + fileNames[i] + '_22k.wav';
        this.drumSounds[i] = new SoundPlayer(this.outputNode);
        this.drumSounds[i].setBuffer(new Tone.Buffer(url));
    }
}

DrumPlayer.prototype.play = function (drum, outputNode) {
    this.drumSounds[drum].outputNode = outputNode;
    this.drumSounds[drum].start();
};

DrumPlayer.prototype.stopAll = function () {
    for (var i=0; i<this.drumSounds.length; i++) {
        this.drumSounds[i].stop();
    }
};

module.exports = DrumPlayer;
