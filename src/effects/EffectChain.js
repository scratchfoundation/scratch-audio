class EffectChain {
    /**
     * Chain of effects that can be applied to a group of SoundPlayers.
     * @param {AudioEngine} audioEngine - engine whose effects these belong to
     * @param {Array<Effect>} effects - array of Effect classes to construct
     */
    constructor (audioEngine, effects) {
        /**
         * AudioEngine whose effects these belong to.
         * @type {AudioEngine}
         */
        this.audioEngine = audioEngine;

        /**
         * Node incoming connections will attach to. This node than connects to
         * the items in the chain which finally connect to some output.
         * @type {AudioNode}
         */
        this.inputNode = this.audioEngine.audioContext.createGain();

        /**
         * List of Effect types to create.
         * @type {Array<Effect>}
         */
        this.effects = effects;

        // Effects are instantiated in reverse so that the first refers to the
        // second, the second refers to the third, etc and the last refers to
        // null.
        let lastEffect = null;
        /**
         * List of instantiated Effects.
         * @type {Array<Effect>}
         */
        this._effects = effects
            .reverse()
            .map(Effect => {
                const effect = new Effect(audioEngine, this, lastEffect);
                this[effect.name] = effect;
                lastEffect = effect;
                return effect;
            })
            .reverse();

        /**
         * First effect of this chain.
         * @type {Effect}
         */
        this.firstEffect = this._effects[0];

        /**
         * Last effect of this chain.
         * @type {Effect}
         */
        this.lastEffect = this._effects[this._effects.length - 1];

        /**
         * A set of players this chain is managing.
         */
        this._soundPlayers = new Set();
    }

    /**
     * Create a clone of the EffectChain.
     * @returns {EffectChain} a clone of this EffectChain
     */
    clone () {
        const chain = new EffectChain(this.audioEngine, this.effects);
        if (this.target) {
            chain.connect(this.target);
        }
        return chain;
    }

    /**
     * Add a sound player.
     * @param {SoundPlayer} soundPlayer - a sound player to manage
     */
    addSoundPlayer (soundPlayer) {
        if (!this._soundPlayers.has(soundPlayer)) {
            this._soundPlayers.add(soundPlayer);
            this.update();
        }
    }

    /**
     * Remove a sound player.
     * @param {SoundPlayer} soundPlayer - a sound player to stop managing
     */
    removeSoundPlayer (soundPlayer) {
        this._soundPlayers.remove(soundPlayer);
    }

    /**
     * Get the audio input node.
     * @returns {AudioNode} audio node the upstream can connect to
     */
    getInputNode () {
        return this.inputNode;
    }

    /**
     * Connnect this player's output to another audio node.
     * @param {object} target - target whose node to should be connected
     */
    connect (target) {
        const {firstEffect, lastEffect} = this;

        if (target === lastEffect) {
            this.inputNode.disconnect();
            this.inputNode.connect(lastEffect.getInputNode());

            return;
        } else if (target === firstEffect) {
            return;
        }

        this.target = target;

        firstEffect.connect(target);
    }

    /**
     * Array of SoundPlayers managed by this EffectChain.
     * @returns {Array<SoundPlayer>} sound players managed by this chain
     */
    getSoundPlayers () {
        return [...this._soundPlayers];
    }

    /**
     * Set Effect values with named values on target.soundEffects if it exist
     * and then from target itself.
     * @param {Target} target - target to set values from
     */
    setEffectsFromTarget (target) {
        this._effects.forEach(effect => {
            if ('soundEffects' in target && effect.name in target.soundEffects) {
                effect.set(target.soundEffects[effect.name]);
            } else if (effect.name in target) {
                effect.set(target[effect.name]);
            }
        });
    }

    /**
     * Set an effect value by its name.
     * @param {string} effect - effect name to change
     * @param {number} value - value to set effect to
     */
    set (effect, value) {
        if (effect in this) {
            this[effect].set(value);
        }
    }

    /**
     * Update managed sound players with the effects on this chain.
     */
    update () {
        this._effects.forEach(effect => effect.update());
    }

    /**
     * Clear all effects to their default values.
     */
    clear () {
        this._effects.forEach(effect => effect.clear());
    }

    /**
     * Dispose of all effects in this chain. Nothing is done to managed
     * SoundPlayers.
     */
    dispose () {
        this._soundPlayers = null;
        this._effects.forEach(effect => effect.dispose());
        this._effects = null;
    }
}

module.exports = EffectChain;
