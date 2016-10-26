var log = require('./log');
var Tone = require('tone');
var Soundfont = require('soundfont-player');

function AudioEngine (sounds) {

    // tone setup

    this.tone = new Tone();

	// effects setup
    // each effect has a single parameter controlled by the effects block

    this.delay = new Tone.FeedbackDelay(0.25, 0.5);
    this.panner = new Tone.Panner();
    this.reverb = new Tone.Freeverb();
    this.distortion = new Tone.Distortion();
    this.pitchEffectValue;


    // the effects are chained to an effects node for this clone, then to the master output
    // so audio is sent from each player or instrument, through the effects in order, then out
    // note that the pitch effect works differently - it sets the playback rate for each player
    this.effectsNode = new Tone.Gain();
    this.effectsNode.chain(this.distortion, this.delay, this.panner, this.reverb, Tone.Master);

    // reset effects to their default parameters
    this.clearEffects();

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

    this.setInstrument(0);

    // tempo in bpm (beats per minute)
    // default is 60bpm

    this.currentTempo = 60;

    // theremin setup

    this.theremin = new Tone.Synth();
    this.portamentoTime = 0.25;
    this.thereminVibrato = new Tone.Vibrato(4, 0.5);
    this.theremin.chain(this.thereminVibrato, this.effectsNode);
    this.thereminTimeout;
    this.thereminIsPlaying = false;
}

AudioEngine.prototype.loadSounds = function (sounds) {
    for (var i=0; i<sounds.length; i++) {
        // skip adpcm form sounds since we can't load them yet
        if (sounds[i].format == 'adpcm') {
            log.warn('cannot load sound in adpcm format');
            continue;
        }
        this.soundPlayers[i] = new Tone.Player(sounds[i].fileUrl);
        this.soundPlayers[i].connect(this.effectsNode);
    }
};

AudioEngine.prototype.playSound = function (index) {
    var player = this.soundPlayers[index];
    if (player && player.buffer.loaded) {
        player.start();
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve();
            }, (player.buffer.duration * 1000) / player.playbackRate);
        });
    } else {
        // if the sound has not yet loaded, wait and try again
        log.warn('sound ' + index + ' not loaded yet');
        if (player) {
            setTimeout(function () {
                this.playSound(index);
            }.bind(this), 500);
        }
    }
};

AudioEngine.prototype.getSoundDuration = function (index) {
    var player = this.soundPlayers[index];
    if (player && player.buffer.loaded) {
        return player.buffer.duration;
    } else {
        return 0;
    }
};

AudioEngine.prototype.playNoteForBeats = function (note, beats) {
    this.instrument.play(
        note, Tone.context.currentTime, {duration : Number(beats)}
    );
};

AudioEngine.prototype.playThereminForBeats = function (note, beats) {
    // if the theremin is playing
    //      ramp to new frequency
    // else
    //      trigger attack
    // create a timeout for slightly longer than the duration of the block
    // that releases the theremin - so we can slide continuously between
    // successive notes without releasing and re-attacking

    var freq = this._midiToFreq(note);

    if (this.thereminIsPlaying) {
        this.theremin.frequency.rampTo(freq, this.portamentoTime);
    } else {
        this.theremin.triggerAttack(freq);
        this.thereminIsPlaying = true;
    }
    clearTimeout(this.thereminTimeout);
    this.thereminTimeout = setTimeout(function () {
        this.theremin.triggerRelease();
        this.thereminIsPlaying = false;
    }.bind(this), (1000 * beats) + 100);
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
    this.instrument.stop();
};

AudioEngine.prototype.setEffect = function (effect, value) {
    switch (effect) {
    case 'ECHO':
        this.delay.wet.value = (value / 100) / 2; // max 50% wet
        break;
    case 'PAN':
        this.panner.pan.value = value / 100;
        break;
    case 'REVERB':
        this.reverb.wet.value = value / 100;
        break;
    case 'PITCH':
        this._setPitchShift(value);
        break;
    case 'DISTORTION' :
        this.distortion.wet.value = value / 100;
        break;
    case 'ROBOTIC' :
        // vocoder effect?
        break;
    }
};

AudioEngine.prototype.changeEffect = function (effect, value) {
    switch (effect) {
    case 'ECHO':
        this.delay.wet.value += (value / 100) / 2; // max 50% wet
        this.delay.wet.value = this._clamp(this.delay.wet.value, 0, 0.5);
        break;
    case 'PAN':
        this.panner.pan.value += value / 100;
        this.panner.pan.value = this._clamp(this.panner.pan.value, -1, 1);
        break;
    case 'REVERB':
        this.reverb.wet.value += value / 100;
        this.reverb.wet.value = this._clamp(this.reverb.wet.value, 0, 1);
        break;
    case 'PITCH':
        this._setPitchShift(this.pitchEffectValue + Number(value));
        break;
    case 'DISTORTION' :
        this.distortion.wet.value += value / 100;
        this.distortion.wet.value = this._clamp(this.distortion.wet.value, 0, 1);
        break;
    case 'ROBOTIC' :
        // vocoder effect?
        break;

    }
};

AudioEngine.prototype._setPitchShift = function (value) {
    this.pitchEffectValue = value;
    if (!this.soundPlayers) {
        return;
    }
    var ratio = this.tone.intervalToFrequencyRatio(this.pitchEffectValue / 10);
    for (var i=0; i<this.soundPlayers.length; i++) {
        var s = this.soundPlayers[i];
        if (s) {
            s.playbackRate = ratio;
        }
    }
};

AudioEngine.prototype.setInstrument = function (instrumentNum) {
    return Soundfont.instrument(Tone.context, this.instrumentNames[instrumentNum]).then(
        function (inst) {
            this.instrument = inst;
            this.instrument.connect(this.effectsNode);
        }.bind(this)
    );
};

AudioEngine.prototype.clearEffects = function () {
    this.delay.wet.value = 0;
    this._setPitchShift(0);
    this.panner.pan.value = 0;
    this.reverb.wet.value = 0;
    this.distortion.wet.value = 0;
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

