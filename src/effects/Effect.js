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

        this.targetNode = null;
    }

    /**
     * Default value to set the Effect to when constructed and when clear'ed.
     * @const {number}
     */
    get DEFAULT_VALUE () {
        return 0;
    }

    /**
     * Does the effect currently affect the player's graph.
     * The pitch effect is always neutral. Instead of affecting the graph it
     * affects the player directly.
     * @return {boolean} is the effect affecting the graph?
     */
    get isNeutral () {
        return !this.initialized;
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
        const isNeutral = this.isNeutral;

        // Call the internal implementation per this Effect.
        this._set(value);

        // Connect or disconnect from the graph if this now applies or no longer
        // applies an effect.
        if (this.isNeutral !== isNeutral && this.targetNode !== null) {
            this.connect(this.targetNode);
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
     * @param {AudioNode} node - the node to connect to
     */
    connect (node) {
        this.targetNode = node;

        if (node === null) {
            return;
        }

        if (this.isNeutral) {
            if (this.lastEffect === null) {
                this.audioPlayer.connect(node);
            } else {
                this.lastEffect.connect(node);
            }
        } else {
            if (this.lastEffect === null) {
                this.audioPlayer.connect(this.inputNode);
            } else {
                this.lastEffect.connect(this.inputNode);
            }
            this.outputNode.connect(node);
        }
    }

    /**
     * Clean up and disconnect audio nodes.
     */
    dispose () {
        this.inputNode = null;
        this.outputNode = null;
        this.targetNode = null;

        this.initialized = false;
    }
}

module.exports = Effect;
