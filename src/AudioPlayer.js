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

        this.outputNode = this.audioEngine.audioContext.createGain();

        // Create the audio effects
        const pitchEffect = new PitchEffect(this.audioEngine, this, null);
        const panEffect = new PanEffect(this.audioEngine, this, pitchEffect);
        this.effects = {
            pitch: pitchEffect,
            pan: panEffect
        };

        // Chain the effects and player together with the audio engine.
        // outputNode -> "pitchEffect" -> panEffect -> audioEngine.input
        panEffect.connect(this.audioEngine);
        pitchEffect.connect(panEffect);

        // reset effects to their default parameters
        this.clearEffects();

        // sound players that are currently playing, indexed by the sound's
        // soundId
        this.activeSoundPlayers = {};
    }

    /**
     * Get this sprite's input node, so that other objects can route sound through it.
     * @return {AudioNode} the AudioNode for this sprite's input
     */
    getInputNode () {
        return this.outputNode;
    }

    /**
     * Get all the sound players owned by this audio player.
     * @return {object<string, SoundPlayer>} mapping of sound ids to sound
     *     players
     */
    getSoundPlayers () {
        return this.activeSoundPlayers;
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
        player.connect(this.outputNode);
        player.start();

        // add it to the list of active sound players
        this.activeSoundPlayers[soundId] = player;
        for (const effectName in this.effects) {
            this.effects[effectName].update();
        }

        // remove sounds that are not playing from the active sound players
        // array
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
        if (this.effects.hasOwnProperty(effect)) {
            this.effects[effect].set(value);
        }
    }

    /**
     * Clear all audio effects
     */
    clearEffects () {
        for (const effectName in this.effects) {
            this.effects[effectName].clear();
        }

        if (this.audioEngine === null) return;
        this.outputNode.gain.setTargetAtTime(1.0, 0, this.audioEngine.DECAY_TIME);
    }

    /**
     * Set the volume for sounds played by this AudioPlayer
     * @param {number} value - the volume in range 0-100
     */
    setVolume (value) {
        if (this.audioEngine === null) return;
        this.outputNode.gain.setTargetAtTime(value / 100, 0, this.audioEngine.DECAY_TIME);
    }

    /**
     * Connnect this player's output to another audio node
     * @param {object} target - target whose node to should be connected
     */
    connect (target) {
        this.outputNode.disconnect();
        this.outputNode.connect(target.getInputNode());
    }

    /**
     * Clean up and disconnect audio nodes.
     */
    dispose () {
        this.effects.pitch.dispose();
        this.effects.pan.dispose();

        this.outputNode.disconnect();
        this.outputNode = null;
    }
}

module.exports = AudioPlayer;
