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

/* Audio Engine

The Scratch runtime has a single audio engine that handles global audio properties and effects,
and creates the instrument player and a drum player, used by all play note and play drum blocks

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

AudioEngine.prototype.loadSounds = function (sounds) {
    // most sounds decode natively, but for adpcm sounds we use our own decoder
    var storedContext = this;
    for (var i=0; i<sounds.length; i++) {

        var md5 = sounds[i].md5;
        var buffer = new Tone.Buffer();
        this.audioBuffers[md5] = buffer;

        if (sounds[i].format == 'squeak') {
            log.warn('unable to load sound in squeak format');
            continue;
        }
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

AudioEngine.prototype.playNoteForBeatsWithInst = function (note, beats, inst) {
    var sec = this.beatsToSec(beats);
    this.instrumentPlayer.playNoteForSecWithInst(note, sec, inst);
    return this.waitForBeats(beats);
};

AudioEngine.prototype.beatsToSec = function (beats) {
    return (60 / this.currentTempo) * beats;
};

AudioEngine.prototype.waitForBeats = function (beats) {
    var storedContext = this;
    return new Promise(function (resolve) {
        setTimeout(function () {
            resolve();
        }, storedContext.beatsToSec(beats) * 1000);
    });
};

AudioEngine.prototype.setTempo = function (value) {
    this.currentTempo = value;
};

AudioEngine.prototype.changeTempo = function (value) {
    this.setTempo(this.currentTempo  + value);
};

AudioEngine.prototype.createPlayer = function () {
    return new AudioPlayer(this);
};

/* Audio Player

Each sprite has an audio player
Clones receive a reference to their parent's audio player
the audio player currently handles sound loading and playback, sprite-specific effects
(pitch and pan) and volume

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
    this.activeSoundPlayers = Object.create({});
}

AudioPlayer.prototype.playSound = function (md5) {
    // if this sprite or clone is already playing this sound, stop it first
    // (this is not working, not sure why)
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

    // when the sound completes, remove it from the list of active sound players
    return player.finished().then(() => {
        delete this.activeSoundPlayers[md5];
    });
};

AudioPlayer.prototype.playDrumForBeats = function (drum, beats) {
    this.audioEngine.drumPlayer.play(drum, this.effectsNode);
    return this.audioEngine.waitForBeats(beats);
};

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

AudioPlayer.prototype.setPitchEffect = function (value) {
    this.pitchEffect.set(value, this.activeSoundPlayers);
};

AudioPlayer.prototype.setEffect = function (effect, value) {
    switch (effect) {
    case 'PITCH':
        this.pitchEffect.set(value, this.soundPlayers);
        break;
    case 'PAN':
        this.panEffect.set(value);
        break;
    case 'ECHO':
        this.audioEngine.echoEffect.set(value);
        break;
    case 'REVERB':
        this.audioEngine.reverbEffect.set(value);
        break;
    case 'FUZZ' :
        this.audioEngine.fuzzEffect.set(value);
        break;
    case 'ROBOT' :
        this.audioEngine.roboticEffect.set(value);
        break;
    }
};

AudioPlayer.prototype.changeEffect = function (effect, value) {
    switch (effect) {
    case 'PITCH':
        this.pitchEffect.changeBy(value, this.soundPlayers);
        break;
    case 'PAN':
        this.panEffect.changeBy(value);
        break;
    case 'ECHO':
        this.audioEngine.echoEffect.changeBy(value);
        break;
    case 'REVERB':
        this.audioEngine.reverbEffect.changeBy(value);
        break;
    case 'FUZZ' :
        this.audioEngine.fuzzEffect.changeBy(value);
        break;
    case 'ROBOT' :
        this.audioEngine.roboticEffect.changeBy(value);
        break;

    }
};

AudioPlayer.prototype.clearEffects = function () {
    this.panEffect.set(0);
    this.pitchEffect.set(0, this.activeSoundPlayers);
    this.effectsNode.gain.value = 1;

    this.audioEngine.echoEffect.set(0);
    this.audioEngine.reverbEffect.set(0);
    this.audioEngine.fuzzEffect.set(0);
    this.audioEngine.roboticEffect.set(0);
};

AudioPlayer.prototype.setVolume = function (value) {
    this.currentVolume = this._clamp(value, 0, 100);
    this.effectsNode.gain.value = this.currentVolume / 100;
};

AudioPlayer.prototype.changeVolume = function (value) {
    this.setVolume(this.currentVolume + value);
};

AudioPlayer.prototype._clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = AudioEngine;

