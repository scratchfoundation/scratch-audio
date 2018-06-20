const StartAudioContext = require('./StartAudioContext');
const AudioContext = require('audio-context');

const log = require('./log');
const uid = require('./uid');

const ADPCMSoundDecoder = require('./ADPCMSoundDecoder');
const Loudness = require('./Loudness');
const SoundPlayer = require('./SoundPlayer');

const EffectChain = require('./effects/EffectChain');
const PanEffect = require('./effects/PanEffect');
const PitchEffect = require('./effects/PitchEffect');
const VolumeEffect = require('./effects/VolumeEffect');

const SoundBank = require('./SoundBank');

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
    constructor (audioContext = new AudioContext()) {
        /**
         * AudioContext to play and manipulate sounds with a graph of source
         * and effect nodes.
         * @type {AudioContext}
         */
        this.audioContext = audioContext;
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

        /**
         * Array of effects applied in order, left to right,
         * Left is closest to input, Right is closest to output
         */
        this.effects = [PanEffect, PitchEffect, VolumeEffect];
    }

    /**
     * Current time in the AudioEngine.
     * @type {number}
     */
    get currentTime () {
        return this.audioContext.currentTime;
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
     * @param {object} sound - an object containing audio data and metadata for
     *     a sound
     * @param {Buffer} sound.data - sound data loaded from scratch-storage
     * @returns {?Promise} - a promise which will resolve to the sound id and
     *     buffer if decoded
     */
    _decodeSound (sound) {
        // Make a copy of the buffer because decoding detaches the original
        // buffer
        const bufferCopy1 = sound.data.buffer.slice(0);

        // todo: multiple decodings of the same buffer create duplicate decoded
        // copies in audioBuffers. Create a hash id of the buffer or deprecate
        // audioBuffers to avoid memory issues for large audio buffers.
        const soundId = uid();

        // Attempt to decode the sound using the browser's native audio data
        // decoder If that fails, attempt to decode as ADPCM
        const decoding = decodeAudioData(this.audioContext, bufferCopy1)
            .catch(() => {
                // The audio context failed to parse the sound data
                // we gave it, so try to decode as 'adpcm'

                // First we need to create another copy of our original data
                const bufferCopy2 = sound.data.buffer.slice(0);
                // Try decoding as adpcm
                return new ADPCMSoundDecoder(this.audioContext).decode(bufferCopy2);
            })
            .then(
                buffer => ([soundId, buffer]),
                error => {
                    log.warn('audio data could not be decoded', error);
                }
            );

        return decoding;
    }

    /**
     * Decode a sound, decompressing it into audio samples.
     *
     * Store a reference to it the sound in the audioBuffers dictionary,
     * indexed by soundId.
     *
     * @param {object} sound - an object containing audio data and metadata for
     *     a sound
     * @param {Buffer} sound.data - sound data loaded from scratch-storage
     * @returns {?Promise} - a promise which will resolve to the sound id
     */
    decodeSound (sound) {
        return this._decodeSound(sound)
            .then(([id, buffer]) => {
                this.audioBuffers[id] = buffer;
                return id;
            });
    }

    /**
     * Decode a sound, decompressing it into audio samples.
     *
     * Create a SoundPlayer instance that can be used to play the sound and
     * stop and fade out playback.
     *
     * @param {object} sound - an object containing audio data and metadata for
     *     a sound
     * @param {Buffer} sound.data - sound data loaded from scratch-storage
     * @returns {?Promise} - a promise which will resolve to the buffer
     */
    decodeSoundPlayer (sound) {
        return this._decodeSound(sound)
        .then(([id, buffer]) => new SoundPlayer(this, {id, buffer}));
    }

    /**
     * Retrieve the audio buffer as held in memory for a given sound id.
     * @todo remove this
     */
    getSoundBuffer () {
        // todo: Deprecate audioBuffers. If something wants to hold onto the
        // buffer, it should. Otherwise buffers need to be able to release their
        // decoded memory to avoid running out of memory which is possible with
        // enough large audio buffers as they are full 16bit pcm waveforms for
        // each audio channel.
        log.warn('The getSoundBuffer function is no longer available. Use soundBank.getSoundPlayer().buffer.');
    }

    /**
     * Add or update the in-memory audio buffer to a new one by soundId.
     * @todo remove this
     */
    updateSoundBuffer () {
        log.warn('The updateSoundBuffer function is no longer available. Use soundBank.getSoundPlayer().buffer.');
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
     * Deprecated way to create an AudioPlayer
     * @todo remove this
     */
    createPlayer () {
        log.warn('the createPlayer method is no longer available, please use createBank');
    }


    createBank () {
        const effects = new EffectChain(this, this.effects);
        effects.connect(this);
        return new SoundBank(this, effects);
    }
}

module.exports = AudioEngine;
