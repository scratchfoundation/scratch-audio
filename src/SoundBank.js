const SoundPlayer = require('./GreenPlayer');
const EffectsChain = require('./effects/EffectChain');

const ALL_TARGETS = '*';

class SoundBank {
    constructor (audioEngine) {
        this.audioEngine = audioEngine;

        this.soundPlayers = {};
        this.playerTargets = new Map();
        this.soundEffects = new Map();
    }

    getSoundPlayer (soundId) {
        if (!this.soundPlayers[soundId]) {
            this.soundPlayers[soundId] = new SoundPlayer(this.audioEngine, {
                id: soundId, buffer: this.audioEngine.audioBuffers[soundId]
            });
        }

        return this.soundPlayers[soundId];
    }

    getSoundEffects (sound) {
        if (!this.soundEffects.has(sound)) {
            this.soundEffects.set(sound, new EffectsChain(this.audioEngine));
        }

        return this.soundEffects.get(sound);
    }


    playSound (target, soundId) {
        const effects = this.getSoundEffects(soundId);
        const player = this.getSoundPlayer(soundId);

        this.playerTargets.set(soundId, target);
        effects.setEffectsFromTarget(target);
        effects.addSoundPlayer(player);

        player.connect(effects);
        player.play();

        return player.finished();
    }

    setEffects (target) {
        this.playerTargets.forEach((playerTarget, key) => {
            if (playerTarget === target) {
                this.getSoundEffects(key).setEffectsFromTarget(target);
            }
        });
    }

    stop (target, soundId) {
        if (this.playerTargets.get(soundId) === target) {
            this.soundPlayers[soundId].stop();
        }
    }

    stopAllSounds (target = ALL_TARGETS) {
        this.playerTargets.forEach((playerTarget, key) => {
            if (target === ALL_TARGETS || playerTarget === target) {
                this.getSoundPlayer(key).stop();
            }
        });
    }

    dispose () {
        this.playerTargets.clear();
        this.soundEffects.forEach(effects => effects.dispose());
        this.soundEffects.clear();
        for (const soundId in this.soundPlayers) {
            if (this.soundPlayers.hasOwnProperty(soundId)) {
                this.soundPlayers[soundId].dispose();
            }
        }
        this.soundPlayers = {};
    }

}

module.exports = SoundBank;
