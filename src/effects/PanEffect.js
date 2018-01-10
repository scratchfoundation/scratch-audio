/**
* A pan effect, which moves the sound to the left or right between the speakers
* Effect value of -100 puts the audio entirely on the left channel,
* 0 centers it, 100 puts it on the right.
*/
class PanEffect {
     /**
     * @param {AudioEngine} audioEngine - the audio engine.
     * @constructor
     */
    constructor (audioEngine) {
        this.audioEngine = audioEngine;
        this.audioContext = this.audioEngine.audioContext;
        this.value = 0;

        this.input = this.audioContext.createGain();
        this.leftGain = this.audioContext.createGain();
        this.rightGain = this.audioContext.createGain();
        this.channelMerger = this.audioContext.createChannelMerger(2);

        this.input.connect(this.leftGain);
        this.input.connect(this.rightGain);
        this.leftGain.connect(this.channelMerger, 0, 0);
        this.rightGain.connect(this.channelMerger, 0, 1);

        this.set(this.value);
    }

    /**
    * Set the effect value
    * @param {number} val - the new value to set the effect to
    */
    set (val) {
        this.value = val;

        // Map the scratch effect value (-100 to 100) to (0 to 1)
        const p = (val + 100) / 200;

        // Use trig functions for equal-loudness panning
        // See e.g. https://docs.cycling74.com/max7/tutorials/13_panningchapter01
        const leftVal = Math.cos(p * Math.PI / 2);
        const rightVal = Math.sin(p * Math.PI / 2);

        this.leftGain.gain.setTargetAtTime(leftVal, 0, this.audioEngine.DECAY_TIME);
        this.rightGain.gain.setTargetAtTime(rightVal, 0, this.audioEngine.DECAY_TIME);
    }

    /**
     * Connnect this effect's output to another audio node
     * @param {AudioNode} node - the node to connect to
     */
    connect (node) {
        this.channelMerger.connect(node);
    }

    /**
     * Clean up and disconnect audio nodes.
     */
    dispose () {
        this.input.disconnect();
        this.leftGain.disconnect();
        this.rightGain.disconnect();
        this.channelMerger.disconnect();
    }
}

module.exports = PanEffect;
