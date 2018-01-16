const StartAudioContext = require('startaudiocontext');
const AudioContext = require('audio-context');

const log = require('./log');
const uid = require('./uid');

const PitchEffect = require('./effects/PitchEffect');
const PanEffect = require('./effects/PanEffect');

const SoundPlayer = require('./SoundPlayer');
const ADPCMSoundDecoder = require('./ADPCMSoundDecoder');

/**
 * @fileOverview Scratch Audio is divided into a single AudioEngine,
 * that handles global functionality, and AudioPlayers, belonging to individual sprites and clones.
 */

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


/**
 * There is a single instance of the AudioEngine. It handles global audio properties and effects,
 * loads all the audio buffers for sounds belonging to sprites.
 */
class AudioEngine {
    constructor () {
        this.audioContext = new AudioContext();
        StartAudioContext(this.audioContext);

        this.input = this.audioContext.createGain();
        this.input.connect(this.audioContext.destination);

        // a map of soundIds to audio buffers, holding sounds for all sprites
        this.audioBuffers = {};

        // microphone, for measuring loudness, with a level meter analyzer
        this.mic = null;
    }

    /**
     * Names of the audio effects.
     * @enum {string}
     */
    get EFFECT_NAMES () {
        return {
            pitch: 'pitch',
            pan: 'pan'
        };
    }

    /**
     * A short duration, for use as a time constant for exponential audio parameter transitions.
     * See:
     * https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime
     * @const {number}
     */
    get DECAY_TIME () {
        return 0.001;
    }

    /**
     * Decode a sound, decompressing it into audio samples.
     * Store a reference to it the sound in the audioBuffers dictionary, indexed by soundId
     * @param  {object} sound - an object containing audio data and metadata for a sound
     * @property {Buffer} data - sound data loaded from scratch-storage.
     * @property {string} format - format type, either empty or adpcm.
     * @returns {?Promise} - a promise which will resolve to the soundId if decoded and stored.
     */
    decodeSound (sound) {
        const soundId = uid();
        let loaderPromise = null;

        // Make a copy of the buffer because decoding detaches the original buffer
        const bufferCopy = sound.data.buffer.slice(0);

        switch (sound.format) {
        case '':
            // Check for newer promise-based API
            if (this.audioContext.decodeAudioData.length === 1) {
                loaderPromise = this.audioContext.decodeAudioData(bufferCopy);
            } else {
                // Fall back to callback API
                loaderPromise = new Promise((resolve, reject) => {
                    this.audioContext.decodeAudioData(bufferCopy,
                        decodedAudio => resolve(decodedAudio),
                        error => reject(error)
                    );
                });
            }
            break;
        case 'adpcm':
            loaderPromise = (new ADPCMSoundDecoder(this.audioContext)).decode(bufferCopy);
            break;
        default:
            return log.warn('unknown sound format', sound.format);
        }

        const storedContext = this;
        return loaderPromise.then(
            decodedAudio => {
                storedContext.audioBuffers[soundId] = decodedAudio;
                return soundId;
            },
            error => {
                log.warn('audio data could not be decoded', error);
            }
        );
    }

    /**
     * Retrieve the audio buffer as held in memory for a given sound id.
     * @param {!string} soundId - the id of the sound buffer to get
     * @return {AudioBuffer} the buffer corresponding to the given sound id.
     */
    getSoundBuffer (soundId) {
        return this.audioBuffers[soundId];
    }

    /**
     * Update the in-memory audio buffer to a new one by soundId.
     * @param {!string} soundId - the id of the sound buffer to update.
     * @param {AudioBuffer} newBuffer - the new buffer to swap in.
     */
    updateSoundBuffer (soundId, newBuffer) {
        this.audioBuffers[soundId] = newBuffer;
    }

    /**
     * An older version of the AudioEngine had this function to load all sounds
     * This is a stub to provide a warning when it is called
     * @todo remove this
     */
    loadSounds () {
        log.warn('The loadSounds function is no longer available. Please use Scratch Storage.');
    }

    /**
     * Get the current loudness of sound received by the microphone.
     * Sound is measured in RMS and smoothed.
     * Some code adapted from Tone.js: https://github.com/Tonejs/Tone.js
     * @return {number} loudness scaled 0 to 100
     */
    getLoudness () {
        // The microphone has not been set up, so try to connect to it
        if (!this.mic && !this.connectingToMic) {
            this.connectingToMic = true; // prevent multiple connection attempts
            navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
                this.audioStream = stream;
                this.mic = this.audioContext.createMediaStreamSource(stream);
                this.analyser = this.audioContext.createAnalyser();
                this.mic.connect(this.analyser);
                this.micDataArray = new Float32Array(this.analyser.fftSize);
            })
            .catch(err => {
                log.warn(err);
            });
        }

        // If the microphone is set up and active, measure the loudness
        if (this.mic && this.audioStream.active) {
            this.analyser.getFloatTimeDomainData(this.micDataArray);
            let sum = 0;
            // compute the RMS of the sound
            for (let i = 0; i < this.micDataArray.length; i++){
                sum += Math.pow(this.micDataArray[i], 2);
            }
            let rms = Math.sqrt(sum / this.micDataArray.length);
            // smooth the value, if it is descending
            if (this._lastValue) {
                rms = Math.max(rms, this._lastValue * 0.6);
            }
            this._lastValue = rms;

            // Scale the measurement so it's more sensitive to quieter sounds
            rms *= 1.63;
            rms = Math.sqrt(rms);
            // Scale it up to 0-100 and round
            rms = Math.round(rms * 100);
            // Prevent it from going above 100
            rms = Math.min(rms, 100);
            return rms;
        }

        // if there is no microphone input, return -1
        return -1;
    }

    /**
     * Create an AudioPlayer. Each sprite or clone has an AudioPlayer.
     * It includes a reference to the AudioEngine so it can use global
     * functionality such as playing notes.
     * @return {AudioPlayer} new AudioPlayer instance
     */
    createPlayer () {
        return new AudioPlayer(this);
    }
}

module.exports = AudioEngine;
