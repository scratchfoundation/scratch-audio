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

    // drum player for play drum blocks
    this.drumPlayer = new DrumPlayer(this.input);
}

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

    this.effectNames = ['PITCH', 'PAN', 'ECHO', 'REVERB', 'FUZZ', 'ROBOT'];

    this.currentVolume = 100;

    this.currentInstrument = 0;
}

AudioPlayer.prototype.loadSounds = function (sounds) {

    this.soundPlayers = [];

    // create a set of empty sound player objects
    // the sound buffers will be added asynchronously as they load
    for (var i=0; i<sounds.length; i++){
        this.soundPlayers[i] = new SoundPlayer(this.effectsNode);
    }

    // load the sounds
    // most sounds decode natively, but for adpcm sounds we use our own decoder
    var storedContext = this;
    for (var index=0; index<sounds.length; index++) {
        if (sounds[index].format == 'squeak') {
            log.warn('unable to load sound in squeak format');
            continue;
        }
        if (sounds[index].format == 'adpcm') {
            log.warn('loading sound in adpcm format');
            // create a closure to store the sound index, to use when the
            // decoder completes and resolves the promise
            (function () {
                var storedIndex = index;
                var loader = new ADPCMSoundLoader();
                loader.load(sounds[storedIndex].fileUrl).then(function (audioBuffer) {
                    storedContext.soundPlayers[storedIndex].setBuffer(new Tone.Buffer(audioBuffer));
                });
            }());
        } else {
            this.soundPlayers[index].setBuffer(new Tone.Buffer(sounds[index].fileUrl));
        }
    }

};

AudioPlayer.prototype.playSound = function (index) {
    if (!this.soundPlayers[index]) return;

    this.soundPlayers[index].start();

    var storedContext = this;
    return new Promise(function (resolve) {
        storedContext.soundPlayers[index].onEnded(resolve);
    });
};

AudioPlayer.prototype.playNoteForBeats = function (note, beats) {
    var sec = this.beatsToSec(beats);
    this.audioEngine.instrumentPlayer.playNoteForSecWithInst(note, sec, this.currentInstrument);
    return this.waitForBeats(beats);
};

AudioPlayer.prototype.playDrumForBeats = function (drum, beats) {
    this.audioEngine.drumPlayer.start();
    return this.waitForBeats(beats);
};

AudioPlayer.prototype.waitForBeats = function (beats) {
    var storedContext = this;
    return new Promise(function (resolve) {
        setTimeout(function () {
            resolve();
        }, storedContext.beatsToSec(beats) * 1000);
    });
};

AudioPlayer.prototype.beatsToSec = function (beats) {
    return (60 / this.audioEngine.currentTempo) * beats;
};

AudioPlayer.prototype.stopAllSounds = function () {
    // stop all sound players
    for (var i=0; i<this.soundPlayers.length; i++) {
        this.soundPlayers[i].stop();
    }

    // stop all instruments
    this.audioEngine.instrumentPlayer.stopAll();

    // stop drum notes
    this.audioEngine.drumPlayer.stopAll();

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
    this.pitchEffect.set(0, this.soundPlayers);
    this.effectsNode.gain.value = 1;

    this.audioEngine.echoEffect.set(0);
    this.audioEngine.reverbEffect.set(0);
    this.audioEngine.fuzzEffect.set(0);
    this.audioEngine.roboticEffect.set(0);
};

AudioPlayer.prototype.setInstrument = function (instrumentNum) {
    this.currentInstrument = instrumentNum;
    return this.audioEngine.instrumentPlayer.loadInstrument(this.currentInstrument);
};

AudioPlayer.prototype.setVolume = function (value) {
    this.currentVolume = this._clamp(value, 0, 100);
    this.effectsNode.gain.value = this.currentVolume / 100;
};

AudioPlayer.prototype.changeVolume = function (value) {
    this.setVolume(this.currentVolume + value);
};

AudioPlayer.prototype.setTempo = function (value) {
    var newTempo = this._clamp(value, 10, 1000);
    this.audioEngine.currentTempo = newTempo;
};

AudioPlayer.prototype.changeTempo = function (value) {
    var newTempo = this._clamp(this.audioEngine.currentTempo + value, 10, 1000);
    this.audioEngine.currentTempo = newTempo;
};

AudioPlayer.prototype._clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = AudioEngine;

