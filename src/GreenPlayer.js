const {EventEmitter} = require('events');

const VolumeEffect = require('./effects/VolumeEffect');

class SoundPlayer extends EventEmitter {
    constructor (audioEngine, {id, buffer}) {
        super();

        this.id = id;

        this.audioEngine = audioEngine;
        this.buffer = buffer;

        this.outputNode = null;
        this.target = null;

        this.initialized = false;
        this.isPlaying = false;
        this.playbackRate = 1;

        this.onEnd = this.onEnd.bind(this);
    }

    onEnd () {
        this.emit('stop');
    }

    initialize () {
        this.outputNode = this.audioEngine.audioContext.createBufferSource();
        this.outputNode.playbackRate.value = this.playbackRate;
        this.outputNode.buffer = this.buffer;

        this.outputNode.addEventListener('end', this.onEnd);

        this.volumeEffect = new VolumeEffect(this.audioEngine, this, null);

        this.initialized = true;

        if (this.target !== null) {
            this.connect(this.target);
            this.setPlaybackRate(this.playbackRate);
        }
    }

    connect (target) {
        if (target === this.volumeEffect) {
            this.outputNode.disconnect();
            this.outputNode.connect(this.volumeEffect.getInputNode());
            return;
        }

        this.target = target;

        if (!this.initialized) {
            return;
        }

        this.volumeEffect.connect(target);

        return this;
    }

    dispose () {
        if (!this.initialized) {
            return;
        }

        this.stopImmediately();

        this.volumeEffect.dispose();

        this.outputNode.disconnect();
        this.outputNode = null;

        this.target = null;

        this.initialized = false;
    }

    take () {
        if (this.outputNode) {
            this.outputNode.removeEventListener('end', this.onEnd);
        }

        const taken = new SoundPlayer(this.audioEngine, this);
        taken.outputNode = this.outputNode;
        if (this.volumeEffect !== null) {
            taken.volumeEffect.set(this.volumeEffect.value);
        }
        if (this.target !== null) {
            taken.connect(this.target);
        }
        taken.initialized = this.initialized;
        taken.isPlaying = this.isPlaying;
        taken.playbackRate = this.playbackRate;

        if (this.isPlaying) {
            this.emit('stop');
            taken.emit('play');
        }

        this.outputNode = null;
        if (this.volumeEffect !== null) {
            this.volumeEffect.dispose();
        }
        this.volumeEffect = null;
        this.target = null;
        this.initialized = false;
        this.isPlaying = false;
    }

    play () {
        if (this.isPlaying) {
            // Spawn a Player with the current buffer source, and play for a
            // short period until its volume is 0 and release it to be
            // eventually garbage collected.
            this.take().stop();
        }

        if (!this.initialized) {
            this.initialize();
        }

        this.volumeEffect.set(this.volumeEffect.DEFAULT_VALUE);
        this.outputNode.start();

        this.isPlaying = true;

        this.emit('play');
    }

    stop () {
        if (!this.isPlaying) {
            return;
        }

        this.volumeEffect.set(0);
        this.outputNode.stop(this.audioEngine.audioEngineoContext.currentTime + this.audioEngine.DECAY_TIME);

        this.isPlaying = false;

        this.emit('stop');
    }

    stopImmediately () {
        if (!this.isPlaying) {
            return;
        }

        this.outputNode.stop();

        this.isPlaying = false;

        this.emit('stop');
    }

    setPlaybackRate (value) {
        this.playbackRate = value;

        if (this.initialized) {
            this.outputNode.playbackRate.value = value;
        }
    }
}

module.exports = SoundPlayer;
