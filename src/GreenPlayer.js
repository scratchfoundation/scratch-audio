const {EventEmitter} = require('events');

const VolumeEffect = require('./effects/VolumeEffect');

const ON_ENDED = 'ended';

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
    }

    /**
     * Handle any event we have told the output node to listen for.
     */
    handleEvent (event) {
        if (event.type === ON_ENDED) {
            this.onEnded();
        }
    }

    onEnded () {
        this.emit('stop');

        this.isPlaying = false;
    }

    _createSource () {
        if (this.outputNode !== null) {
            this.outputNode.removeEventListener(ON_ENDED, this);
            this.outputNode.disconnect();
        }

        this.outputNode = this.audioEngine.audioContext.createBufferSource();
        this.outputNode.playbackRate.value = this.playbackRate;
        this.outputNode.buffer = this.buffer;

        this.outputNode.addEventListener(ON_ENDED, this);

        if (this.target !== null) {
            this.connect(this.target);
        }
    }

    initialize () {
        this.initialized = true;

        this.volumeEffect = new VolumeEffect(this.audioEngine, this, null);

        this._createSource();
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
            this.outputNode.removeEventListener(ON_ENDED, this);
        }

        const taken = new SoundPlayer(this.audioEngine, this);
        taken.playbackRate = this.playbackRate;
        if (this.isPlaying) {
            taken.isPlaying = this.isPlaying;
            taken.initialize();
            taken.outputNode.disconnect();
            taken.outputNode = this.outputNode;
            taken.outputNode.addEventListener(ON_ENDED, taken);
            taken.volumeEffect.set(this.volumeEffect.value);
            if (this.target !== null) {
                taken.connect(this.target);
            }
        }

        if (this.isPlaying) {
            this.emit('stop');
            taken.emit('play');
        }

        this.outputNode = null;
        if (this.volumeEffect !== null) {
            this.volumeEffect.dispose();
        }
        this.volumeEffect = null;
        this.initialized = false;
        this.isPlaying = false;

        return taken;
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
        } else {
            this._createSource();
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
        this.outputNode.stop(this.audioEngine.audioContext.currentTime + this.audioEngine.DECAY_TIME);

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

    finished () {
        return new Promise(resolve => {
            this.once('stop', resolve);
        });
    }

    setPlaybackRate (value) {
        this.playbackRate = value;

        if (this.initialized) {
            this.outputNode.playbackRate.value = value;
        }
    }
}

module.exports = SoundPlayer;
