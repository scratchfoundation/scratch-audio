const StartAudioContext = require('startaudiocontext');
const AudioContext = require('audio-context');

const log = require('./log');
const uid = require('./uid');

const ADPCMSoundDecoder = require('./ADPCMSoundDecoder');

const AudioPlayer = require('./AudioPlayer');
const Loudness = require('./Loudness');

/**
 * Wrapper to ensure that audioContext.decodeAudioData is a promise
 * @param {object} audioContext The current AudioContext
 * @param {ArrayBuffer} buffer Audio data buffer to decode
 * @return {Promise} A promise that resolves to the decoded audio
 */
const decodeAudioData = function (audioContext, buffer) {
    // Check for newer promise-based API
    if (audioContext.decodeAudioData.length === 1) {
        return audioContext.decodeAudioData(buffer);
    }
    // Fall back to callback API
    return new Promise((resolve, reject) => {
        audioContext.decodeAudioData(buffer,
            decodedAudio => resolve(decodedAudio),
            error => reject(error)
        );
    });
};

/**
 * There is a single instance of the AudioEngine. It handles global audio
 * properties and effects, loads all the audio buffers for sounds belonging to
 * sprites.
 */
class AudioEngine {
    constructor () {
        /**
         * AudioContext to play and manipulate sounds with a graph of source
         * and effect nodes.
         * @type {AudioContext}
         */
        this.audioContext = new AudioContext();
        StartAudioContext(this.audioContext);

        /**
         * Master GainNode that all sounds plays through. Changing this node
         * will change the volume for all sounds.
         * @type {GainNode}
         */
        this.inputNode = this.audioContext.createGain();
        this.inputNode.connect(this.audioContext.destination);

        /**
         * a map of soundIds to audio buffers, holding sounds for all sprites
         * @type {Object<String, ArrayBuffer>}
         */
        this.audioBuffers = {};

        /**
         * A Loudness detector.
         * @type {Loudness}
         */
        this.loudness = null;
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
     * A short duration to transition audio prarameters.
     *
     * Used as a time constant for exponential transitions. A general value
     * must be large enough that it does not cute off lower frequency, or bass,
     * sounds. Human hearing lower limit is ~20Hz making a safe value 25
     * milliseconds or 0.025 seconds, where half of a 20Hz wave will play along
     * with the DECAY. Higher frequencies will play multiple waves during the
     * same amount of time and avoid clipping.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime}
     * @const {number}
     */
    get DECAY_TIME () {
        return 0.025;
    }

    /**
     * Get the input node.
     * @return {AudioNode} - audio node that is the input for this effect
     */
    getInputNode () {
        return this.inputNode;
    }

    /**
     * Decode a sound, decompressing it into audio samples.
     * Store a reference to it the sound in the audioBuffers dictionary, indexed by soundId
     * @param  {object} sound - an object containing audio data and metadata for a sound
     * @property {Buffer} data - sound data loaded from scratch-storage.
     * @returns {?Promise} - a promise which will resolve to the soundId if decoded and stored.
     */
    decodeSound (sound) {
        // Make a copy of the buffer because decoding detaches the original buffer
        const bufferCopy1 = sound.data.buffer.slice(0);

        const soundId = uid();
        // Partially apply updateSoundBuffer function with the current
        // soundId so that it's ready to be used on successfully decoded audio
        const addDecodedAudio = this.updateSoundBuffer.bind(this, soundId);

        // Attempt to decode the sound using the browser's native audio data decoder
        // If that fails, attempt to decode as ADPCM
        return decodeAudioData(this.audioContext, bufferCopy1).then(
            addDecodedAudio,
            () => {
                // The audio context failed to parse the sound data
                // we gave it, so try to decode as 'adpcm'

                // First we need to create another copy of our original data
                const bufferCopy2 = sound.data.buffer.slice(0);
                // Try decoding as adpcm
                return (new ADPCMSoundDecoder(this.audioContext)).decode(bufferCopy2)
                    .then(
                        addDecodedAudio,
                        error => {
                            log.warn('audio data could not be decoded', error);
                        }
                    );
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
     * Add or update the in-memory audio buffer to a new one by soundId.
     * @param {!string} soundId - the id of the sound buffer to update.
     * @param {AudioBuffer} newBuffer - the new buffer to swap in.
     * @return {string} The uid of the sound that was updated or added
     */
    updateSoundBuffer (soundId, newBuffer) {
        this.audioBuffers[soundId] = newBuffer;
        return soundId;
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
     * @return {number} loudness scaled 0 to 100
     */
    getLoudness () {
        // The microphone has not been set up, so try to connect to it
        if (!this.loudness) {
            this.loudness = new Loudness(this.audioContext);
        }

        return this.loudness.getLoudness();
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
