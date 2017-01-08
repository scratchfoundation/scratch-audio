var log = require('./log');
var Tone = require('tone');

var PitchEffect = require('./effects/PitchEffect');
var PanEffect = require('./effects/PanEffect');

var RoboticEffect = require('./effects/RoboticEffect');
var FuzzEffect = require('./effects/FuzzEffect');
var EchoEffect = require('./effects/EchoEffect');
var ReverbEffect = require('./effects/ReverbEffect');

var SoundPlayer = require('./SoundPlayer');
var Soundfont = require('soundfont-player');
var ADPCMSoundLoader = require('./ADPCMSoundLoader');

function AudioEngine () {
    this.roboticEffect = new RoboticEffect();
    this.fuzzEffect = new FuzzEffect();
    this.echoEffect = new EchoEffect();
    this.reverbEffect = new ReverbEffect();

    this.input = new Tone.Gain();
    this.input.chain (
        this.roboticEffect, this.fuzzEffect, this.echoEffect, this.reverbEffect,
        Tone.Master
    );

    // alternate version without effects:
    // this.input = new Tone.Gain();
    // this.input.connect(Tone.Master);

}

AudioEngine.prototype.createPlayer = function () {
    return new AudioPlayer(this);
};

function AudioPlayer (audioEngine) {

    this.audioEngine = audioEngine;

    // effects setup
    this.pitchEffect = new PitchEffect();
    this.panEffect = new PanEffect();

    // the effects are chained to an effects node for this player, then to the master output
    // so audio is sent from each player or instrument, through the effects in order, then out
    // note that the pitch effect works differently - it sets the playback rate for each player
    this.effectsNode = new Tone.Gain();
    this.effectsNode.chain(this.panEffect, this.audioEngine.input);

    // reset effects to their default parameters
    this.clearEffects();

    this.effectNames = ['PITCH', 'PAN', 'ECHO', 'REVERB', 'FUZZ', 'ROBOT'];

    // soundfont instrument setup

    // instrument names used by Musyng Kite soundfont, in order to
    // match scratch instruments
    this.instrumentNames = ['acoustic_grand_piano', 'electric_piano_1',
        'drawbar_organ', 'acoustic_guitar_nylon', 'electric_guitar_clean',
         'acoustic_bass', 'pizzicato_strings', 'cello', 'trombone', 'clarinet',
         'tenor_sax', 'flute', 'pan_flute', 'bassoon', 'choir_aahs', 'vibraphone',
         'music_box', 'steel_drums', 'marimba', 'lead_1_square', 'fx_4_atmosphere'];

    this.instrumentNum;
    this.setInstrument(1);

    // tempo in bpm (beats per minute)
    // default is 60bpm

    this.currentTempo = 60;

    this.currentVolume = 100;
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
    this.instrument.play(
        note, Tone.context.currentTime, {duration : Number(beats)}
    );
};

AudioPlayer.prototype._midiToFreq = function (midiNote) {
    var freq = this.tone.intervalToFrequencyRatio(midiNote - 60) * 261.63; // 60 is C4
    return freq;
};

AudioPlayer.prototype.playDrumForBeats = function () {
    // this.drumSamplers[drumNum].triggerAttack();
};

AudioPlayer.prototype.stopAllSounds = function () {
    // stop drum notes
    // for (var i = 0; i<this.drumSamplers.length; i++) {
    //     this.drumSamplers[i].triggerRelease();
    // }

    // stop sounds triggered with playSound
    for (var i=0; i<this.soundPlayers.length; i++) {
        this.soundPlayers[i].stop();
    }

    // stop soundfont notes
    if (this.instrument) {
        this.instrument.stop();
    }
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
    this.instrumentNum = instrumentNum - 1;

    return Soundfont.instrument(Tone.context, this.instrumentNames[this.instrumentNum]).then(
        function (inst) {
            this.instrument = inst;
            this.instrument.connect(this.effectsNode);
        }.bind(this)
    );
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
    this.currentTempo = newTempo;
};

AudioPlayer.prototype.changeTempo = function (value) {
    var newTempo = this._clamp(this.currentTempo + value, 10, 1000);
    this.currentTempo = newTempo;
};

AudioPlayer.prototype._clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = AudioEngine;

