class EffectChain {
    constructor (audioEngine) {
        this.audioEngine = audioEngine;

        this.outputNode = this.audioEngine.audioContext.createGain();

        this.lastEffect = null;

        this._effects = audioEngine.effects.map(Effect => {
            const effect = new Effect(audioEngine, this, this.lastEffect);
            this[effect.name] = effect;
            this.lastEffect = effect;
            return effect;
        });

        // Walk backwards through effects connecting the last output to audio engine,
        // then each effect's output to the input of the next effect.
        this._effects.reduceRight((nextNode, effect) => {
            effect.connect(nextNode);
            return effect;
        }, this.audioEngine);

        this._soundPlayers = new Set();
    }

    addSoundPlayer (soundPlayer) {
        if (!this._soundPlayers.has(soundPlayer)) {
            this._soundPlayers.add(soundPlayer);
            this._effects.forEach(effect => effect.update());
        }
    }

    removeSoundPlayer (soundPlayer) {
        this._soundPlayers.remove(soundPlayer);
    }

    getInputNode () {
        return this.outputNode;
    }

    /**
     * Connnect this player's output to another audio node
     * @param {object} target - target whose node to should be connected
     */
    connect (target) {
        this.outputNode.disconnect();
        this.outputNode.connect(target.getInputNode());
    }


    getSoundPlayers () {
        return [...this._soundPlayers];
    }

    setEffectsFromTarget (target) {
        this._effects.forEach(effect => {
            if (effect.name in target) {
                effect.set(target[effect.name]);
            } else if ('soundEffects' in target && effect.name in target.soundEffects) {
                effect.set(target.soundEffects[effect.name]);
            } else {
                effect.set(effect.DEFAULT_VALUE);
            }
        });
    }

    set (effect, value) {
        if (effect in this) {
            this[effect].set(value);
        }
    }

    clear () {
        this._effects.forEach(effect => effect.clear());
    }

    dispose () {
        this._soundPlayers = null;
        this._effects.forEach(effect => effect.dispose());
        this._effects = null;
    }
}

module.exports = EffectChain;
