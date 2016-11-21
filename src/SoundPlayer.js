var Tone = require('tone');
var log = require('./log');

function SoundPlayer (outputNode) {
    this.outputNode = outputNode;
    this.buffer; // a Tone.Buffer
    this.bufferSource;
    this.playbackRate = 1;
    this.isPlaying = false;
}

SoundPlayer.prototype.setBuffer = function (buffer) {
    this.buffer = buffer;
};

SoundPlayer.prototype.setPlaybackRate = function (playbackRate) {
    this.playbackRate = playbackRate;
    if (this.bufferSource && this.bufferSource.playbackRate) {
        this.bufferSource.playbackRate.value = this.playbackRate;
    }
};

SoundPlayer.prototype.stop = function () {
    if (this.isPlaying){
        this.bufferSource.stop();
    }
};

SoundPlayer.prototype.start = function () {
    if (!this.buffer || !this.buffer.loaded) {
        log.warn('tried to play a sound that was not loaded yet');
        return;
    }

    this.stop();

    this.bufferSource = new Tone.BufferSource(this.buffer.get());
    this.bufferSource.playbackRate.value = this.playbackRate;
    this.bufferSource.connect(this.outputNode);
    this.bufferSource.start();
    this.isPlaying = true;
};

SoundPlayer.prototype.onEnded = function (callback) {
    this.bufferSource.onended = function () {
        this.isPlaying = false;
        callback();
    };
};

module.exports = SoundPlayer;
