class EffectChain {
    constructor (audioEngine, effects) {
        this.audioEngine = audioEngine;

        this.inputNode = this.audioEngine.audioContext.createGain();

        this.effects = effects;

        this.lastEffect = null;

        this._effects = effects.map(Effect => {
            const effect = new Effect(audioEngine, this, this.lastEffect);
            this[effect.name] = effect;
            this.lastEffect = effect;
            return effect;
        });

        this._soundPlayers = new Set();
    }

    clone () {
        const chain = new EffectChain(this.audioEngine, this.effects);
        if (this.target === target) {
            chain.connect(target);
        }
        return chain;
    }

    addSoundPlayer (soundPlayer) {
        if (!this._soundPlayers.has(soundPlayer)) {
            this._soundPlayers.add(soundPlayer);
            this.update();
        }
    }

    removeSoundPlayer (soundPlayer) {
        this._soundPlayers.remove(soundPlayer);
    }

    getInputNode () {
        return this.inputNode;
    }

    /**
     * Connnect this player's output to another audio node
     * @param {object} target - target whose node to should be connected
     */
    connect (target) {
        const {lastEffect} = this;
        if (target === lastEffect) {
            this.inputNode.disconnect();
            this.inputNode.connect(lastEffect.getInputNode());

            return;
        }

        this.target = target;

        this._effects[0].connect(target);
    }


    getSoundPlayers () {
        return [...this._soundPlayers];
    }

    setEffectsFromTarget (target) {
        this._effects.forEach(effect => {
            if ('soundEffects' in target && effect.name in target.soundEffects) {
                effect.set(target.soundEffects[effect.name]);
            } else if (effect.name in target) {
                effect.set(target[effect.name]);
            }
        });
    }

    set (effect, value) {
        if (effect in this) {
            this[effect].set(value);
        }
    }

    update () {
        this._effects.forEach(effect => effect.update());
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
