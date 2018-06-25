/**
 * An effect on an AudioPlayer and all its SoundPlayers.
 */
class Effect {
     /**
      * @param {AudioEngine} audioEngine - audio engine this runs with
      * @param {AudioPlayer} audioPlayer - audio player this affects
      * @param {Effect} lastEffect - effect in the chain before this one
      * @constructor
      */
    constructor (audioEngine, audioPlayer, lastEffect) {
        this.audioEngine = audioEngine;
        this.audioPlayer = audioPlayer;
        this.lastEffect = lastEffect;

        this.value = this.DEFAULT_VALUE;

        this.initialized = false;

        this.inputNode = null;
        this.outputNode = null;

        this.target = null;
    }

    /**
     * Return the name of the effect.
     * @type {string}
     */
    get name () {
        throw new Error(`${this.constructor.name}.name is not implemented`);
    }

    /**
     * Default value to set the Effect to when constructed and when clear'ed.
     * @const {number}
     */
    get DEFAULT_VALUE () {
        return 0;
    }

    /**
     * Should the effect be connected to the audio graph?
     * The pitch effect is an example that does not need to be patched in.
     * Instead of affecting the graph it affects the player directly.
     * @return {boolean} is the effect affecting the graph?
     */
    get _isPatch () {
        return this.initialized && (this.value !== this.DEFAULT_VALUE || this.audioPlayer === null);
    }

    /**
     * Get the input node.
     * @return {AudioNode} - audio node that is the input for this effect
     */
    getInputNode () {
        if (this._isPatch) {
            return this.inputNode;
        }
        return this.target.getInputNode();
    }

    /**
     * Initialize the Effect.
     * Effects start out uninitialized. Then initialize when they are first set
     * with some value.
     * @throws {Error} throws when left unimplemented
     */
    initialize () {
        throw new Error(`${this.constructor.name}.initialize is not implemented.`);
    }

    /**
     * Set the effects value.
     * @private
     * @param {number} value - new value to set effect to
     */
    _set () {
        throw new Error(`${this.constructor.name}._set is not implemented.`);
    }

    /**
     * Set the effects value.
     * @param {number} value - new value to set effect to
     */
    set (value) {
        // Initialize the node on first set.
        if (!this.initialized) {
            this.initialize();
        }

        // Store whether the graph should currently affected by this effect.
        const wasPatch = this._isPatch;
        if (wasPatch) {
            this._lastPatch = this.audioEngine.currentTime;
        }

        // Call the internal implementation per this Effect.
        this._set(value);

        // Connect or disconnect from the graph if this now applies or no longer
        // applies an effect.
        if (this._isPatch !== wasPatch && this.target !== null) {
            this.connect(this.target);
        }
    }

    /**
     * Update the effect for changes in the audioPlayer.
     */
    update () {}

    /**
     * Clear the value back to the default.
     */
    clear () {
        this.set(this.DEFAULT_VALUE);
    }

    /**
     * Connnect this effect's output to another audio node
     * @param {object} target - target whose node to should be connected
     */
    connect (target) {
        if (target === null) {
            throw new Error('target may not be null');
        }

        const checkForCircularReference = subtarget => {
            if (subtarget) {
                if (subtarget === this) {
                    return true;
                }
                return checkForCircularReference(subtarget.target);
            }
        };
        if (checkForCircularReference(target)) {
            throw new Error('Effect cannot connect to itself');
        }

        this.target = target;

        if (this.outputNode !== null) {
            this.outputNode.disconnect();
        }

        if (this._isPatch || this._lastPatch + this.audioEngine.DECAY_DURATION < this.audioEngine.currentTime) {
            this.outputNode.connect(target.getInputNode());
        }

        if (this.lastEffect === null) {
            if (this.audioPlayer !== null) {
                this.audioPlayer.connect(this);
            }
        } else {
            this.lastEffect.connect(this);
        }
    }

    /**
     * Clean up and disconnect audio nodes.
     */
    dispose () {
        this.inputNode = null;
        this.outputNode = null;
        this.target = null;

        this.initialized = false;
    }
}

module.exports = Effect;
