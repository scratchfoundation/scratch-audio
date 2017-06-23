/**
* A pan effect, which moves the sound to the left or right between the speakers
* Effect value of -100 puts the audio entirely on the left channel,
* 0 centers it, 100 puts it on the right.
* Clamped -100 to 100
*/
class PanEffect {
     /**
     * @param {AudioContext} audioContext - a webAudio context
     * @constructor
     */
    constructor (audioContext) {
        this.audioContext = audioContext;
        this.panner = this.audioContext.createStereoPanner();
        this.value = 0;
    }

    /**
    * Set the effect value
    * @param {number} val - the new value to set the effect to
    */
    set (val) {
        this.value = this.clamp(val, -100, 100);
        this.panner.pan.value = this.value / 100;
    }

    connect (node) {
        this.panner.connect(node);
    }

    /**
    * Change the effect value
    * @param {number} val - the value to change the effect by
    */
    changeBy (val) {
        this.set(this.value + val);
    }

    /**
    * Clamp the input to a range
    * @param {number} input - the input to clamp
    * @param {number} min - the min value to clamp to
    * @param {number} max - the max value to clamp to
    * @return {number} the clamped value
    */
    clamp (input, min, max) {
        return Math.min(Math.max(input, min), max);
    }
}

module.exports = PanEffect;
