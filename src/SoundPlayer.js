var Tone = require('tone');

function SoundPlayer (outputNode) {
    this.outputNode = outputNode;
    this.buffer; // a Tone.Buffer
    this.bufferSource;
    this.playbackRate = 1;
}

SoundPlayer.prototype.setBuffer = function (buffer) {
    this.buffer = buffer;
};

SoundPlayer.prototype.setPlaybackRate = function (playbackRate) {
    this.playbackRate = playbackRate;
};

SoundPlayer.prototype.stop = function () {
    if (this.bufferSource){
        this.bufferSource.stop();
    }
};

SoundPlayer.prototype.start = function () {
    this.stop();

    this.bufferSource = new Tone.BufferSource(this.buffer.get());
    this.bufferSource.playbackRate.value = this.playbackRate;
    this.bufferSource.connect(this.outputNode);
    this.bufferSource.start();
};

SoundPlayer.prototype.onEnded = function (callback) {
    this.bufferSource.onended = function () {callback();};
};

module.exports = SoundPlayer;
