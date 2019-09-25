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

        /**
         * Unique sound identifier set by AudioEngine.
         * @type {string}
         */
        this.id = id;

        /**
         * AudioEngine creating this sound player.
         * @type {AudioEngine}
         */
        this.audioEngine = audioEngine;

        /**
         * Decoded audio buffer from audio engine for playback.
         * @type {AudioBuffer}
         */
        this.buffer = buffer;

        /**
         * Output audio node.
         * @type {AudioNode}
         */
        this.outputNode = null;

        /**
         * VolumeEffect used to fade out playing sounds when stopping them.
         * @type {VolumeEffect}
         */
        this.volumeEffect = null;


        /**
         * Target engine, effect, or chain this player directly connects to.
         * @type {AudioEngine|Effect|EffectChain}
         */
        this.target = null;

        /**
         * Internally is the SoundPlayer initialized with at least its buffer
         * source node and output node.
         * @type {boolean}
         */
        this.initialized = false;

        /**
         * Is the sound playing or starting to play?
         * @type {boolean}
         */
        this.isPlaying = false;

        /**
         * Timestamp sound is expected to be starting playback until. Once the
         * future timestamp is reached the sound is considered to be playing
         * through the audio hardware and stopping should fade out instead of
         * cutting off playback.
         * @type {number}
         */
        this.startingUntil = 0;

        /**
         * Rate to play back the audio at.
         * @type {number}
         */
        this.playbackRate = 1;

        // handleEvent is a EventTarget api for the DOM, however the
        // web-audio-test-api we use uses an addEventListener that isn't
        // compatable with object and requires us to pass this bound function
        // instead
        this.handleEvent = this.handleEvent.bind(this);
    }

    /**
     * Is plaback currently starting?
     * @type {boolean}
     */
    get isStarting () {
        return this.isPlaying && this.startingUntil > this.audioEngine.currentTime;
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
            this.outputNode.removeEventListener(ON_ENDED, this.handleEvent);
            this.outputNode.disconnect();
        }

        this.outputNode = this.audioEngine.audioContext.createBufferSource();
        this.outputNode.playbackRate.value = this.playbackRate;
        this.outputNode.buffer = this.buffer;

        this.outputNode.addEventListener(ON_ENDED, this.handleEvent);

        if (this.target !== null) {
            this.connect(this.target);
        }
    }

    /**
     * Initialize the player for first playback.
     */
    initialize () {
        this.initialized = true;

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

        if (this.volumeEffect === null) {
            this.outputNode.disconnect();
            this.outputNode.connect(target.getInputNode());
        } else {
            this.volumeEffect.connect(target);
        }

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

        if (this.volumeEffect !== null) {
            this.volumeEffect.dispose();
            this.volumeEffect = null;
        }

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
            this.outputNode.removeEventListener(ON_ENDED, this.handleEvent);
        }

        const taken = new SoundPlayer(this.audioEngine, this);
        taken.playbackRate = this.playbackRate;
        if (this.isPlaying) {
            taken.startingUntil = this.startingUntil;
            taken.isPlaying = this.isPlaying;
            taken.initialized = this.initialized;
            taken.outputNode = this.outputNode;
            taken.outputNode.addEventListener(ON_ENDED, taken.handleEvent);
            taken.volumeEffect = this.volumeEffect;
            if (taken.volumeEffect) {
                taken.volumeEffect.audioPlayer = taken;
            }
            if (this.target !== null) {
                taken.connect(this.target);
            }

            this.emit('stop');
            taken.emit('play');
        }

        this.outputNode = null;
        this.volumeEffect = null;
        this.initialized = false;
        this.startingUntil = 0;
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
        if (this.isStarting) {
            this.emit('stop');
            this.emit('play');
            return;
        }

        if (this.isPlaying) {
            this.stop();
        }

        if (this.initialized) {
            this._createSource();
        } else {
            this.initialize();
        }

        this.outputNode.start();

        this.isPlaying = true;

        const {currentTime, DECAY_DURATION} = this.audioEngine;
        this.startingUntil = currentTime + DECAY_DURATION;

        this.emit('play');
    }

    /**
     * Stop playback after quickly fading out.
     */
    stop () {
        if (!this.isPlaying) {
            return;
        }

        // always do a manual stop on a taken / volume effect fade out sound
        // player take will emit "stop" as well as reset all of our playing
        // statuses / remove our nodes / etc
        const taken = this.take();
        taken.volumeEffect = new VolumeEffect(taken.audioEngine, taken, null);

        taken.volumeEffect.connect(taken.target);
        // volumeEffect will recursively connect to us if it needs to, so this
        // happens too:
        // taken.connect(taken.volumeEffect);

        taken.finished().then(() => taken.dispose());

        taken.volumeEffect.set(0);
        const {currentTime, DECAY_DURATION} = this.audioEngine;
        taken.outputNode.stop(currentTime + DECAY_DURATION);
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
        this.startingUntil = 0;

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
