var log = require('./log');
var Tone = require('tone');

var PitchEffect = require('./effects/PitchEffect');
var PanEffect = require('./effects/PanEffect');

var RoboticEffect = require('./effects/RoboticEffect');
var FuzzEffect = require('./effects/FuzzEffect');
var EchoEffect = require('./effects/EchoEffect');
var ReverbEffect = require('./effects/ReverbEffect');

var SoundPlayer = require('./SoundPlayer');
var ADPCMSoundLoader = require('./ADPCMSoundLoader');
var InstrumentPlayer = require('./InstrumentPlayer');
var DrumPlayer = require('./DrumPlayer');

/**
 * @fileOverview Scratch Audio is divided into a single AudioEngine,
 * that handles global functionality, and AudioPlayers, belonging to individual sprites and clones.
 */

/**
 * There is a single instance of the AudioEngine. It handles global audio properties and effects,
 * loads all the audio buffers for sounds belonging to sprites, and creates a single instrument player
 * and a drum player, used by all play note and play drum blocks.
 * @constructor
 */
function AudioEngine () {

    // create the global audio effects
    this.roboticEffect = new RoboticEffect();
    this.fuzzEffect = new FuzzEffect();
    this.echoEffect = new EchoEffect();
    this.reverbEffect = new ReverbEffect();

    // chain the global effects to the output
    this.input = new Tone.Gain();
    this.input.chain (
        this.roboticEffect, this.fuzzEffect, this.echoEffect, this.reverbEffect,
        Tone.Master
    );

    // global tempo in bpm (beats per minute)
    this.currentTempo = 60;

    // instrument player for play note blocks
    this.instrumentPlayer = new InstrumentPlayer(this.input);
    this.numInstruments = this.instrumentPlayer.instrumentNames.length;

    // drum player for play drum blocks
    this.drumPlayer = new DrumPlayer(this.input);
    this.numDrums = this.drumPlayer.drumSounds.length;

    // a map of md5s to audio buffers, holding sounds for all sprites
    this.audioBuffers = {};
}

/**
 * Load all sounds for a sprite and store them in the audioBuffers dictionary, indexed by md5
 * @param  {Object} sounds - an array of objects containing metadata for sound files of a sprite
 */
AudioEngine.prototype.loadSounds = function (sounds) {
    var storedContext = this;
    for (var i=0; i<sounds.length; i++) {

        var md5 = sounds[i].md5;
        var buffer = new Tone.Buffer();
        this.audioBuffers[md5] = buffer;

        // Squeak sound format (not implemented yet)
        if (sounds[i].format == 'squeak') {
            log.warn('unable to load sound in squeak format');
            continue;
        }
        // most sounds decode natively, but for adpcm sounds we use our own decoder
        if (sounds[i].format == 'adpcm') {
            log.warn('loading sound in adpcm format');
            // create a closure to store the sound md5, to use when the
            // decoder completes and resolves the promise
            (function () {
                var storedMd5 = sounds[i].md5;
                var loader = new ADPCMSoundLoader();
                loader.load(sounds[i].fileUrl).then(function (audioBuffer) {
                    storedContext.audioBuffers[storedMd5] = new Tone.Buffer(audioBuffer);
                });
            }());
        } else {
            this.audioBuffers[md5] = new Tone.Buffer(sounds[i].fileUrl);
        }
    }
};

/**
 * Play a note for a duration on an instrument
 * @param  {number} note - a MIDI note number
 * @param  {number} beats - a duration in beats
 * @param  {number} inst - an instrument number (0-indexed)
 * @return {Promise} a Promise that resolves after the duration has elapsed
 */
AudioEngine.prototype.playNoteForBeatsWithInst = function (note, beats, inst) {
    var sec = this.beatsToSec(beats);
    this.instrumentPlayer.playNoteForSecWithInst(note, sec, inst);
    return this.waitForBeats(beats);
};

/**
 * Convert a number of beats to a number of seconds, using the current tempo
 * @param  {number} beats
 * @return {number} seconds
 */
AudioEngine.prototype.beatsToSec = function (beats) {
    return (60 / this.currentTempo) * beats;
};

/**
 * Wait for some number of beats
 * @param  {number} beats
 * @return {Promise} a Promise that resolves after the duration has elapsed
 */
AudioEngine.prototype.waitForBeats = function (beats) {
    var storedContext = this;
    return new Promise(function (resolve) {
        setTimeout(function () {
            resolve();
        }, storedContext.beatsToSec(beats) * 1000);
    });
};

/**
 * Set the global tempo in bpm (beats per minute)
 * @param {number} value - the new tempo to set
 */
AudioEngine.prototype.setTempo = function (value) {
    this.currentTempo = value;
};

/**
 * Change the tempo by some number of bpm (beats per minute)
 * @param  {number} value - the number of bpm to change the tempo by
 */
AudioEngine.prototype.changeTempo = function (value) {
    this.setTempo(this.currentTempo  + value);
};

/**
 * Names of the audio effects.
 * @readonly
 * @enum {string}
 */
AudioEngine.prototype.EFFECT_NAMES = {
    pitch: 'pitch',
    pan: 'pan',
    echo: 'echo',
    reverb: 'reverb',
    fuzz: 'fuzz',
    robot: 'robot'
};

/**
 * Create an AudioPlayer. Each sprite or clone has an AudioPlayer.
 * It includes a reference to the AudioEngine so it can use global
 * functionality such as playing notes.
 * @return {AudioPlayer}
 */
AudioEngine.prototype.createPlayer = function () {
    return new AudioPlayer(this);
};


/**
 * Each sprite or clone has an audio player
 * the audio player handles sound playback, volume, and the sprite-specific audio effects:
 * pitch and pan
 * @param {AudioEngine}
 * @constructor
 */
function AudioPlayer (audioEngine) {

    this.audioEngine = audioEngine;

    // effects setup
    this.pitchEffect = new PitchEffect();
    this.panEffect = new PanEffect();

    // the effects are chained to an effects node for this player, then to the main audio engine
    // audio is sent from each soundplayer, through the effects in order, then to the global effects
    // note that the pitch effect works differently - it sets the playback rate for each soundplayer
    this.effectsNode = new Tone.Gain();
    this.effectsNode.chain(this.panEffect, this.audioEngine.input);

    // reset effects to their default parameters
    this.clearEffects();

    // sound players that are currently playing, indexed by the sound's md5
    this.activeSoundPlayers = {};
}

/**
 * Play a sound
 * @param  {string} md5 - the md5 id of a sound file
 * @return {Promise} a Promise that resolves when the sound finishes playing
 */
AudioPlayer.prototype.playSound = function (md5) {
    // if this sound is not in the audio engine, return
    if (!this.audioEngine.audioBuffers[md5]) {
        return;
    }

    // if this sprite or clone is already playing this sound, stop it first
    if (this.activeSoundPlayers[md5]) {
        this.activeSoundPlayers[md5].stop();
    }

    // create a new soundplayer to play the sound
    var player = new SoundPlayer();
    player.setBuffer(this.audioEngine.audioBuffers[md5]);
    player.connect(this.effectsNode);
    this.pitchEffect.updatePlayer(player);
    player.start();

    // add it to the list of active sound players
    this.activeSoundPlayers[md5] = player;

    // remove sounds that are not playing from the active sound players array
    for (var id in this.activeSoundPlayers) {
        if (this.activeSoundPlayers.hasOwnProperty(id)) {
            if (!this.activeSoundPlayers[id].isPlaying) {
                delete this.activeSoundPlayers[id];
            }
        }
    }

    return player.finished();
};

/**
 * Play a drum sound. The AudioEngine contains the DrumPlayer, but the AudioPlayer
 * calls this function so that it can pass a reference to its own effects node.
 * @param  {number} drum - a drum number (0-indexed)
 * @param  {number} beats - a duration in beats
 * @return {Promise} a Promise that resolves after the duration has elapsed
 */
AudioPlayer.prototype.playDrumForBeats = function (drum, beats) {
    this.audioEngine.drumPlayer.play(drum, this.effectsNode);
    return this.audioEngine.waitForBeats(beats);
};

/**
 * Stop all sounds, notes and drums that are playing
 */
AudioPlayer.prototype.stopAllSounds = function () {
    // stop all active sound players
    for (var md5 in this.activeSoundPlayers) {
        this.activeSoundPlayers[md5].stop();
    }

    // stop all instruments
    this.audioEngine.instrumentPlayer.stopAll();

    // stop drum notes
    this.audioEngine.drumPlayer.stopAll();
};

/**
 * Set an audio effect to a value
 * @param {string} effect - the name of the effect
 * @param {number} value - the value to set the effect to
 */
AudioPlayer.prototype.setEffect = function (effect, value) {
    switch (effect) {
    case this.audioEngine.EFFECT_NAMES.pitch:
        this.pitchEffect.set(value, this.activeSoundPlayers);
        break;
    case this.audioEngine.EFFECT_NAMES.pan:
        this.panEffect.set(value);
        break;
    case this.audioEngine.EFFECT_NAMES.echo:
        this.audioEngine.echoEffect.set(value);
        break;
    case this.audioEngine.EFFECT_NAMES.reverb:
        this.audioEngine.reverbEffect.set(value);
        break;
    case this.audioEngine.EFFECT_NAMES.fuzz:
        this.audioEngine.fuzzEffect.set(value);
        break;
    case this.audioEngine.EFFECT_NAMES.robot:
        this.audioEngine.roboticEffect.set(value);
        break;
    }
};

/**
 * Clear all audio effects
 */
AudioPlayer.prototype.clearEffects = function () {
    this.panEffect.set(0);
    this.pitchEffect.set(0, this.activeSoundPlayers);
    this.effectsNode.gain.value = 1;

    this.audioEngine.echoEffect.set(0);
    this.audioEngine.reverbEffect.set(0);
    this.audioEngine.fuzzEffect.set(0);
    this.audioEngine.roboticEffect.set(0);
};

/**
 * Set the volume for sounds played by this AudioPlayer
 * @param {number} value - the volume in range 0-100
 */
AudioPlayer.prototype.setVolume = function (value) {
    this.effectsNode.gain.value = value / 100;
};

module.exports = AudioEngine;

