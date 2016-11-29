var log = require('./log');
var Tone = require('tone');

var PitchEffect = require('./effects/PitchEffect');
var EchoEffect = require('./effects/EchoEffect');
var PanEffect = require('./effects/PanEffect');
var RoboticEffect = require('./effects/RoboticEffect');
var ReverbEffect = require('./effects/ReverbEffect');
var FuzzEffect = require('./effects/FuzzEffect');
var WobbleEffect = require('./effects/WobbleEffect');

var SoundPlayer = require('./SoundPlayer');
var Soundfont = require('soundfont-player');
var ADPCMSoundLoader = require('./ADPCMSoundLoader');

function AudioEngine (sounds) {

    // tone setup

    this.tone = new Tone();

	// effects setup
    this.pitchEffect = new PitchEffect();
    this.echoEffect = new EchoEffect();
    this.panEffect = new PanEffect();
    this.reverbEffect = new ReverbEffect();
    this.fuzzEffect = new FuzzEffect();
    this.wobbleEffect = new WobbleEffect();
    this.roboticEffect = new RoboticEffect();

    // the effects are chained to an effects node for this clone, then to the master output
    // so audio is sent from each player or instrument, through the effects in order, then out
    // note that the pitch effect works differently - it sets the playback rate for each player
    this.effectsNode = new Tone.Gain();
    this.effectsNode.chain(
        this.roboticEffect, this.fuzzEffect, this.echoEffect,
        this.wobbleEffect, this.panEffect, this.reverbEffect, Tone.Master);

    // reset effects to their default parameters
    this.clearEffects();

    this.effectNames = ['PITCH', 'PAN', 'ECHO', 'REVERB', 'FUZZ', 'TELEPHONE', 'WOBBLE', 'ROBOTIC'];

    // load sounds

    this.soundPlayers = [];
    this.loadSounds(sounds);

   // soundfont setup

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
}

AudioEngine.prototype.loadSounds = function (sounds) {

    this.soundPlayers = [];

    // create a set of empty sound player objects
    // the sound buffers will be added asynchronously as they load
    for (var i=0; i<sounds.length; i++){
        this.soundPlayers[i] = new SoundPlayer(this.effectsNode);
    }

    // load the sounds- most sounds decode natively, but for adpcm sounds
    // we use our own decoder
    var storedContext = this;
    for (var index=0; index<sounds.length; index++) {
        if (sounds[index].format == 'adpcm') {
            log.warn('attempting to load sound in adpcm format');
            // create a closure to store the sound index, to use when the
            // docder completes and resolves the promise
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

AudioEngine.prototype.playSound = function (index) {
    this.soundPlayers[index].start();

    var storedContext = this;
    return new Promise(function (resolve) {
        storedContext.soundPlayers[index].onEnded(resolve);
    });
};

AudioEngine.prototype.playNoteForBeats = function (note, beats) {
    this.instrument.play(
        note, Tone.context.currentTime, {duration : Number(beats)}
    );

/*
    // if the soundplayer exists and its buffer has loaded
    if (this.soundPlayers[this.instrumentNum] && this.soundPlayers[this.instrumentNum].buffer.loaded) {
        // create a new buffer source to play the sound
        var bufferSource = new Tone.BufferSource(this.soundPlayers[this.instrumentNum].buffer.get());
        bufferSource.connect(this.effectsNode);
        bufferSource.start('+0', 0, beats);
        var ratio = this.tone.intervalToFrequencyRatio(note - 60);
        bufferSource.playbackRate.value = ratio;

        return new Promise(function (resolve) {
            setTimeout( function () {
                resolve();
            }, 1000 * beats);
        });
    }
*/
};

AudioEngine.prototype._midiToFreq = function (midiNote) {
    var freq = this.tone.intervalToFrequencyRatio(midiNote - 60) * 261.63; // 60 is C4
    return freq;
};

AudioEngine.prototype.playDrumForBeats = function (drumNum) {
    this.drumSamplers[drumNum].triggerAttack();
};

AudioEngine.prototype.stopAllSounds = function () {
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

AudioEngine.prototype.setEffect = function (effect, value) {
    switch (effect) {
    case 'PITCH':
        this.pitchEffect.set(value, this.soundPlayers);
        break;
    case 'PAN':
        this.panEffect.set(value);
        break;
    case 'ECHO':
        this.echoEffect.set(value);
        break;
    case 'REVERB':
        this.reverbEffect.set(value);
        break;
    case 'FUZZ' :
        this.fuzzEffect.set(value);
        break;
    case 'WOBBLE' :
        this.wobbleEffect.set(value);
        break;
    case 'ROBOTIC' :
        this.roboticEffect.set(value);
        break;
    }
};

AudioEngine.prototype.changeEffect = function (effect, value) {
    switch (effect) {
    case 'PITCH':
        this.pitchEffect.changeBy(value, this.soundPlayers);
        break;
    case 'PAN':
        this.panEffect.changeBy(value);
        break;
    case 'ECHO':
        this.echoEffect.changeBy(value);
        break;
    case 'REVERB':
        this.reverbEffect.changeBy(value);
        break;
    case 'FUZZ' :
        this.fuzzEffect.changeBy(value);
        break;
    case 'WOBBLE' :
        this.wobbleEffect.changeBy(value);
        break;
    case 'ROBOTIC' :
        this.roboticEffect.changeBy(value);
        break;

    }
};

AudioEngine.prototype.clearEffects = function () {
    this.echoEffect.set(0);
    this.panEffect.set(0);
    this.reverbEffect.set(0);
    this.fuzzEffect.set(0);
    this.roboticEffect.set(0);
    this.wobbleEffect.set(0);
    this.pitchEffect.set(0, this.soundPlayers);

    this.effectsNode.gain.value = 1;
};

AudioEngine.prototype.setInstrument = function (instrumentNum) {
    this.instrumentNum = instrumentNum - 1;

    return Soundfont.instrument(Tone.context, this.instrumentNames[this.instrumentNum]).then(
        function (inst) {
            this.instrument = inst;
            this.instrument.connect(this.effectsNode);
        }.bind(this)
    );
};

AudioEngine.prototype.setVolume = function (value) {
    var vol = this._clamp(value, 0, 100);
    vol /= 100;
    this.effectsNode.gain.value = vol;
};

AudioEngine.prototype.changeVolume = function (value) {
    value /= 100;
    var newVol = this.effectsNode.gain.value + value;
    this.effectsNode.gain.value = this._clamp(newVol, 0, 1);
};

AudioEngine.prototype.setTempo = function (value) {
    var newTempo = this._clamp(value, 10, 1000);
    this.currentTempo = newTempo;
};

AudioEngine.prototype.changeTempo = function (value) {
    var newTempo = this._clamp(this.currentTempo + value, 10, 1000);
    this.currentTempo = newTempo;
};

AudioEngine.prototype._clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = AudioEngine;

