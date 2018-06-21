const log = require('./log');

/**
 * A symbol indicating all targets are to be effected.
 * @const {string}
 */
const ALL_TARGETS = '*';

class SoundBank {
    /**
     * A bank of sounds that can be played.
     * @constructor
     * @param {AudioEngine} audioEngine - related AudioEngine
     * @param {EffectChain} effectChainPrime - original EffectChain cloned for
     *     playing sounds
     */
    constructor (audioEngine, effectChainPrime) {
        /**
         * AudioEngine this SoundBank is related to.
         * @type {AudioEngine}
         */
        this.audioEngine = audioEngine;

        /**
         * Map of ids to soundPlayers.
         * @type {object<SoundPlayer>}
         */
        this.soundPlayers = {};

        /**
         * Map of targets by sound id.
         * @type {Map<string, Target>}
         */
        this.playerTargets = new Map();

        /**
         * Map of effect chains by sound id.
         * @type {Map<string, EffectChain}
         */
        this.soundEffects = new Map();

        /**
         * Original EffectChain cloned for every playing sound.
         * @type {EffectChain}
         */
        this.effectChainPrime = effectChainPrime;
    }

    /**
     * Add a sound player instance likely from AudioEngine.decodeSoundPlayer
     * @param {SoundPlayer} soundPlayer - SoundPlayer to add
     */
    addSoundPlayer (soundPlayer) {
        this.soundPlayers[soundPlayer.id] = soundPlayer;
    }

    /**
     * Get a sound player by id.
     * @param {string} soundId - sound to look for
     * @returns {SoundPlayer} instance of sound player for the id
     */
    getSoundPlayer (soundId) {
        if (!this.soundPlayers[soundId]) {
            log.error(`SoundBank.getSoundPlayer(${soundId}): called missing sound in bank`);
        }

        return this.soundPlayers[soundId];
    }

    /**
     * Get a sound EffectChain by id.
     * @param {string} sound - sound to look for an EffectChain
     * @returns {EffectChain} available EffectChain for this id
     */
    getSoundEffects (sound) {
        if (!this.soundEffects.has(sound)) {
            this.soundEffects.set(sound, this.effectChainPrime.clone());
        }

        return this.soundEffects.get(sound);
    }

    /**
     * Play a sound.
     * @param {Target} target - Target to play for
     * @param {string} soundId - id of sound to play
     * @returns {Promise} promise that resolves when the sound finishes playback
     */
    playSound (target, soundId) {
        const effects = this.getSoundEffects(soundId);
        const player = this.getSoundPlayer(soundId);

        if (this.playerTargets.get(soundId) !== target) {
            // make sure to stop the old sound, effectively "forking" the output
            // when the target switches before we adjust it's effects
            player.stop();
        }

        this.playerTargets.set(soundId, target);
        effects.addSoundPlayer(player);
        effects.setEffectsFromTarget(target);
        player.connect(effects);

        player.play();

        return player.finished();
    }

    /**
     * Set the effects (pan, pitch, and volume) from values on the given target.
     * @param {Target} target - target to set values from
     */
    setEffects (target) {
        this.playerTargets.forEach((playerTarget, key) => {
            if (playerTarget === target) {
                this.getSoundEffects(key).setEffectsFromTarget(target);
            }
        });
    }

    /**
     * Stop playback of sound by id if was lasted played by the target.
     * @param {Target} target - target to check if it last played the sound
     * @param {string} soundId - id of the sound to stop
     */
    stop (target, soundId) {
        if (this.playerTargets.get(soundId) === target) {
            this.soundPlayers[soundId].stop();
        }
    }

    /**
     * Stop all sounds for all targets or a specific target.
     * @param {Target|string} target - a symbol for all targets or the target
     *     to stop sounds for
     */
    stopAllSounds (target = ALL_TARGETS) {
        this.playerTargets.forEach((playerTarget, key) => {
            if (target === ALL_TARGETS || playerTarget === target) {
                this.getSoundPlayer(key).stop();
            }
        });
    }

    /**
     * Dispose of all EffectChains and SoundPlayers.
     */
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
