const Effect = require('./Effect');

/**
 * A pan effect, which moves the sound to the left or right between the speakers
 * Effect value of -100 puts the audio entirely on the left channel,
 * 0 centers it, 100 puts it on the right.
 */
class PanEffect extends Effect {
    /**
     * @param {AudioEngine} audioEngine - audio engine this runs with
     * @param {AudioPlayer} audioPlayer - audio player this affects
     * @param {Effect} lastEffect - effect in the chain before this one
     * @constructor
     */
    constructor (audioEngine, audioPlayer, lastEffect) {
        super(audioEngine, audioPlayer, lastEffect);

        this.leftGain = null;
        this.rightGain = null;
        this.channelMerger = null;
    }

    /**
     * Return the name of the effect.
     * @type {string}
     */
    get name () {
        return 'pan';
    }

    /**
     * Initialize the Effect.
     * Effects start out uninitialized. Then initialize when they are first set
     * with some value.
     * @throws {Error} throws when left unimplemented
     */
    initialize () {
        const audioContext = this.audioEngine.audioContext;

        this.inputNode = audioContext.createGain();
        this.leftGain = audioContext.createGain();
        this.rightGain = audioContext.createGain();
        this.channelMerger = audioContext.createChannelMerger(2);
        this.outputNode = this.channelMerger;

        this.inputNode.connect(this.leftGain);
        this.inputNode.connect(this.rightGain);
        this.leftGain.connect(this.channelMerger, 0, 0);
        this.rightGain.connect(this.channelMerger, 0, 1);

        this.initialized = true;
    }

    /**
     * Set the effect value
     * @param {number} value - the new value to set the effect to
     */
    _set (value) {
        this.value = value;

        // Map the scratch effect value (-100 to 100) to (0 to 1)
        const p = (value + 100) / 200;

        // Use trig functions for equal-loudness panning
        // See e.g. https://docs.cycling74.com/max7/tutorials/13_panningchapter01
        const leftVal = Math.cos(p * Math.PI / 2);
        const rightVal = Math.sin(p * Math.PI / 2);

        const {currentTime, DECAY_WAIT, DECAY_DURATION} = this.audioEngine;
        this.leftGain.gain.setTargetAtTime(leftVal, currentTime + DECAY_WAIT, DECAY_DURATION);
        this.rightGain.gain.setTargetAtTime(rightVal, currentTime + DECAY_WAIT, DECAY_DURATION);
    }

    /**
     * Clean up and disconnect audio nodes.
     */
    dispose () {
        if (!this.initialized) {
            return;
        }

        this.inputNode.disconnect();
        this.leftGain.disconnect();
        this.rightGain.disconnect();
        this.channelMerger.disconnect();

        this.inputNode = null;
        this.leftGain = null;
        this.rightGain = null;
        this.channelMerger = null;
        this.outputNode = null;
        this.target = null;

        this.initialized = false;
    }
}

module.exports = PanEffect;
