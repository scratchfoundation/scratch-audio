const PanEffect = require('./effects/PanEffect');
const PitchEffect = require('./effects/PitchEffect');
const VolumeEffect = require('./effects/VolumeEffect');

const SoundPlayer = require('./GreenPlayer');

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

        // Create the audio effects.
        const volumeEffect = new VolumeEffect(this.audioEngine, this, null);
        const pitchEffect = new PitchEffect(this.audioEngine, this, volumeEffect);
        const panEffect = new PanEffect(this.audioEngine, this, pitchEffect);
        this.effects = {
            volume: volumeEffect,
            pitch: pitchEffect,
            pan: panEffect
        };

        // Chain the effects and player together with the audio engine.
        // outputNode -> "pitchEffect" -> panEffect -> audioEngine.input
        panEffect.connect(this.audioEngine);
        pitchEffect.connect(panEffect);
        volumeEffect.connect(pitchEffect);

        // Reset effects to their default parameters.
        this.clearEffects();

        // SoundPlayers mapped by sound id.
        this.soundPlayers = {};
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
        return this.soundPlayers;
    }

    /**
     * Add a SoundPlayer instance to soundPlayers map.
     * @param {SoundPlayer} soundPlayer - SoundPlayer instance to add
     */
    addSoundPlayer (soundPlayer) {
        this.soundPlayers[soundPlayer.id] = soundPlayer;

        for (const effectName in this.effects) {
            this.effects[effectName].update();
        }
    }

    /**
     * Play a sound
     * @param  {string} soundId - the soundId id of a sound file
     * @return {Promise} a Promise that resolves when the sound finishes playing
     */
    playSound (soundId) {
        // create a new soundplayer to play the sound
        if (!this.soundPlayers[soundId]) {
            this.addSoundPlayer(new SoundPlayer(
                this.audioEngine,
                {id: soundId, buffer: this.audioEngine.audioBuffers[soundId]}
            ));
        }
        const player = this.soundPlayers[soundId];
        player.connect(this);
        player.play();

        return player.finished();
    }

    /**
     * Stop all sounds that are playing
     */
    stopAllSounds () {
        // stop all active sound players
        for (const soundId in this.soundPlayers) {
            this.soundPlayers[soundId].stop();
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
    }

    /**
     * Set the volume for sounds played by this AudioPlayer
     * @param {number} value - the volume in range 0-100
     */
    setVolume (value) {
        this.setEffect('volume', value);
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
        this.effects.volume.dispose();
        this.effects.pitch.dispose();
        this.effects.pan.dispose();

        this.outputNode.disconnect();
        this.outputNode = null;
    }
}

module.exports = AudioPlayer;
