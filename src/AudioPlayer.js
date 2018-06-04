const PitchEffect = require('./effects/PitchEffect');
const PanEffect = require('./effects/PanEffect');

const SoundPlayer = require('./SoundPlayer');

class AudioPlayer {
    /**
     * Each sprite or clone has an audio player
     * the audio player handles sound playback, volume, and the sprite-specific audio effects:
     * pitch and pan
     * @param {AudioEngine} audioEngine AudioEngine for player
     * @constructor
     */
    constructor (audioEngine) {
        this.audioEngine = audioEngine;

        // Create the audio effects
        this.pitchEffect = new PitchEffect();
        this.panEffect = new PanEffect(this.audioEngine);

        // Chain the audio effects together
        // effectsNode -> panEffect -> audioEngine.input
        this.effectsNode = this.audioEngine.audioContext.createGain();
        this.effectsNode.connect(this.panEffect.input);
        this.panEffect.connect(this.audioEngine.input);

        // reset effects to their default parameters
        this.clearEffects();

        // sound players that are currently playing, indexed by the sound's soundId
        this.activeSoundPlayers = {};
    }

    /**
     * Get this sprite's input node, so that other objects can route sound through it.
     * @return {AudioNode} the AudioNode for this sprite's input
     */
    getInputNode () {
        return this.effectsNode;
    }

    /**
     * Play a sound
     * @param  {string} soundId - the soundId id of a sound file
     * @return {Promise} a Promise that resolves when the sound finishes playing
     */
    playSound (soundId) {
        // if this sound is not in the audio engine, return
        if (!this.audioEngine.audioBuffers[soundId]) {
            return;
        }

        // if this sprite or clone is already playing this sound, stop it first
        if (this.activeSoundPlayers[soundId]) {
            this.activeSoundPlayers[soundId].stop();
        }

        // create a new soundplayer to play the sound
        const player = new SoundPlayer(this.audioEngine.audioContext);
        player.setBuffer(this.audioEngine.audioBuffers[soundId]);
        player.connect(this.effectsNode);
        this.pitchEffect.updatePlayer(player);
        player.start();

        // add it to the list of active sound players
        this.activeSoundPlayers[soundId] = player;

        // remove sounds that are not playing from the active sound players array
        for (const id in this.activeSoundPlayers) {
            if (this.activeSoundPlayers.hasOwnProperty(id)) {
                if (!this.activeSoundPlayers[id].isPlaying) {
                    delete this.activeSoundPlayers[id];
                }
            }
        }

        return player.finished();
    }

    /**
     * Stop all sounds that are playing
     */
    stopAllSounds () {
        // stop all active sound players
        for (const soundId in this.activeSoundPlayers) {
            this.activeSoundPlayers[soundId].stop();
        }
    }

    /**
     * Set an audio effect to a value
     * @param {string} effect - the name of the effect
     * @param {number} value - the value to set the effect to
     */
    setEffect (effect, value) {
        switch (effect) {
        case this.audioEngine.EFFECT_NAMES.pitch:
            this.pitchEffect.set(value, this.activeSoundPlayers);
            break;
        case this.audioEngine.EFFECT_NAMES.pan:
            this.panEffect.set(value);
            break;
        }
    }

    /**
     * Clear all audio effects
     */
    clearEffects () {
        this.panEffect.set(0);
        this.pitchEffect.set(0, this.activeSoundPlayers);
        if (this.audioEngine === null) return;
        this.effectsNode.gain.setTargetAtTime(1.0, 0, this.audioEngine.DECAY_TIME);
    }

    /**
     * Set the volume for sounds played by this AudioPlayer
     * @param {number} value - the volume in range 0-100
     */
    setVolume (value) {
        if (this.audioEngine === null) return;
        this.effectsNode.gain.setTargetAtTime(value / 100, 0, this.audioEngine.DECAY_TIME);
    }

    /**
     * Clean up and disconnect audio nodes.
     */
    dispose () {
        this.panEffect.dispose();
        this.effectsNode.disconnect();
    }
}

module.exports = AudioPlayer;
