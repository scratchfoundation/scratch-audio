const {EventEmitter} = require('events');

const VolumeEffect = require('./effects/VolumeEffect');

/**
 * Name of event that indicates playback has ended.
 * @const {string}
 */
const ON_ENDED = 'ended';

class SoundPlayer extends EventEmitter {
    /**
     * Play sounds that stop without audible clipping.
     *
     * @param {AudioEngine} audioEngine - engine to play sounds on
     * @param {object} data - required data for sound playback
     * @param {string} data.id - a unique id for this sound
     * @param {ArrayBuffer} data.buffer - buffer of the sound's waveform to play
     * @constructor
     */
    constructor (audioEngine, {id, buffer}) {
        super();

        this.id = id;

        this.audioEngine = audioEngine;
        this.buffer = buffer;

        this.outputNode = null;
        this.target = null;
        this.volumeEffect = null;

        this.initialized = false;
        this.isPlaying = false;
        this.playbackRate = 1;
    }

    /**
     * Handle any event we have told the output node to listen for.
     * @param {Event} event - dom event to handle
     */
    handleEvent (event) {
        if (event.type === ON_ENDED) {
            this.onEnded();
        }
    }

    /**
     * Event listener for when playback ends.
     */
    onEnded () {
        this.emit('stop');

        this.isPlaying = false;
    }

    /**
     * Create the buffer source node during initialization or secondary
     * playback.
     */
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

    /**
     * Initialize the player for first playback.
     */
    initialize () {
        this.initialized = true;

        this.volumeEffect = new VolumeEffect(this.audioEngine, this, null);

        this._createSource();
    }

    /**
     * Connect the player to the engine or an effect chain.
     * @param {object} target - object to connect to
     * @returns {object} - return this sound player
     */
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

    /**
     * Teardown the player.
     */
    dispose () {
        if (!this.initialized) {
            return;
        }

        this.stopImmediately();

        this.volumeEffect.dispose();
        this.volumeEffect = null;

        this.outputNode.disconnect();
        this.outputNode = null;

        this.target = null;

        this.initialized = false;
    }

    /**
     * Take the internal state of this player and create a new player from
     * that. Restore the state of this player to that before its first playback.
     *
     * The returned player can be used to stop the original playback or
     * continue it without manipulation from the original player.
     *
     * @returns {SoundPlayer} - new SoundPlayer with old state
     */
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

    /**
     * Start playback for this sound.
     *
     * If the sound is already playing it will stop playback with a quick fade
     * out.
     */
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

    /**
     * Stop playback after quickly fading out.
     */
    stop () {
        if (!this.isPlaying) {
            return;
        }

        this.volumeEffect.set(0);
        this.outputNode.stop(this.audioEngine.audioContext.currentTime + this.audioEngine.DECAY_TIME);

        this.isPlaying = false;

        this.emit('stop');
    }

    /**
     * Stop immediately without fading out. May cause audible clipping.
     */
    stopImmediately () {
        if (!this.isPlaying) {
            return;
        }

        this.outputNode.stop();

        this.isPlaying = false;

        this.emit('stop');
    }

    /**
     * Return a promise that resolves when the sound next finishes.
     * @returns {Promise} - resolves when the sound finishes
     */
    finished () {
        return new Promise(resolve => {
            this.once('stop', resolve);
        });
    }

    /**
     * Set the sound's playback rate.
     * @param {number} value - playback rate. Default is 1.
     */
    setPlaybackRate (value) {
        this.playbackRate = value;

        if (this.initialized) {
            this.outputNode.playbackRate.value = value;
        }
    }
}

module.exports = SoundPlayer;
