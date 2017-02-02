var Tone = require('tone');
var log = require('./log');

function SoundPlayer () {
    this.outputNode = null;
    this.buffer = new Tone.Buffer();
    this.bufferSource = null;
    this.playbackRate = 1;
    this.isPlaying = false;
}
SoundPlayer.prototype.connect = function (node) {
    this.outputNode = node;
};

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
    if (this.bufferSource) {
        this.bufferSource.stop();
    }
    this.isPlaying = false;
};

SoundPlayer.prototype.start = function () {
    if (!this.buffer || !this.buffer.loaded) {
        log.warn('tried to play a sound that was not loaded yet');
        return;
    }

    this.bufferSource = new Tone.BufferSource(this.buffer.get());
    this.bufferSource.playbackRate.value = this.playbackRate;
    this.bufferSource.connect(this.outputNode);
    this.bufferSource.start();

    this.isPlaying = true;
};

SoundPlayer.prototype.finished = function () {
    var storedContext = this;
    return new Promise(function (resolve) {
        storedContext.bufferSource.onended = function () {
            this.isPlaying = false;
            resolve();
        };
    });
};

module.exports = SoundPlayer;
