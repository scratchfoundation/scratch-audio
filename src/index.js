var log = require('./log');
var Tone = require('tone');
var SoundPlayer = require('./SoundPlayer');
var Soundfont = require('soundfont-player');
var Vocoder = require('./vocoder');
var ADPCMSoundLoader = require('./ADPCMSoundLoader');

function AudioEngine (sounds) {

    // tone setup

    this.tone = new Tone();

	// effects setup
    // each effect has a single parameter controlled by the effects block

    this.delay = new Tone.FeedbackDelay(0.25, 0.5);
    this.panner = new Tone.Panner();
    this.reverb = new Tone.Freeverb();
    this.distortion = new Tone.Distortion(1);
    this.pitchEffectValue;
    this.vocoder = new Vocoder();

    this.wobble = new Tone.Effect();
    var wobbleLFO = new Tone.LFO(10, 0, 1).start();
    var wobbleGain = new Tone.Gain();
    wobbleLFO.connect(wobbleGain.gain);
    this.wobble.effectSend.chain(wobbleGain, this.wobble.effectReturn);

    // telephone effect - simulating the 'tinny' sound coming over a phone line
    // using a lowpass filter and a highpass filter
    this.telephone = new Tone.Effect();
    var telephoneLP = new Tone.Filter(1200, 'lowpass', -24);
    var telephoneHP = new Tone.Filter(800, 'highpass', -24);
    this.telephone.effectSend.chain(telephoneLP, telephoneHP, this.telephone.effectReturn);

    // the effects are chained to an effects node for this clone, then to the master output
    // so audio is sent from each player or instrument, through the effects in order, then out
    // note that the pitch effect works differently - it sets the playback rate for each player
    this.effectsNode = new Tone.Gain();
    this.effectsNode.chain(
        // this.vocoder,
        this.distortion, this.delay, this.telephone,
        this.wobble, this.panner, this.reverb, Tone.Master);

    // reset effects to their default parameters
    this.clearEffects();

    // load sounds

    this.soundPlayers = [];
    this.loadSounds(sounds);
    // Tone.Buffer.on('load', this._soundsLoaded.bind(this));

   // soundfont setup

    // instrument names used by Musyng Kite soundfont, in order to
    // match scratch instruments
    this.instrumentNames = ['acoustic_grand_piano', 'electric_piano_1',
        'drawbar_organ', 'acoustic_guitar_nylon', 'electric_guitar_clean',
         'acoustic_bass', 'pizzicato_strings', 'cello', 'trombone', 'clarinet',
         'tenor_sax', 'flute', 'pan_flute', 'bassoon', 'choir_aahs', 'vibraphone',
         'music_box', 'steel_drums', 'marimba', 'lead_1_square', 'fx_4_atmosphere'];

    this.instrumentNum;
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
    if (this.instrument) {
        this.instrument.stop();
    }
};

AudioEngine.prototype.setEffect = function (effect, value) {
    switch (effect) {
    case 'PITCH':
        this._setPitchShift(value);
        break;
    case 'PAN':
        this.panner.pan.value = value / 100;
        break;
    case 'ECHO':
        this.delay.wet.value = (value / 100) / 2; // max 50% wet
        break;
    case 'REVERB':
        this.reverb.wet.value = value / 100;
        break;
    case 'FUZZ' :
        this.distortion.wet.value = value / 100;
        break;
    case 'TELEPHONE' :
        this.telephone.wet.value = value / 100;
        break;
    case 'WOBBLE' :
        this.wobble.wet.value = value / 100;
        break;
    case 'ROBOTIC' :
        this.vocoder.wet.value = value / 100;
        break;
    }
};

AudioEngine.prototype.changeEffect = function (effect, value) {
    switch (effect) {
    case 'PITCH':
        this._setPitchShift(this.pitchEffectValue + Number(value));
        break;
    case 'PAN':
        this.panner.pan.value += value / 100;
        this.panner.pan.value = this._clamp(this.panner.pan.value, -1, 1);
        break;
    case 'ECHO':
        this.delay.wet.value += (value / 100) / 2; // max 50% wet
        this.delay.wet.value = this._clamp(this.delay.wet.value, 0, 0.5);
        break;
    case 'REVERB':
        this.reverb.wet.value += value / 100;
        this.reverb.wet.value = this._clamp(this.reverb.wet.value, 0, 1);
        break;
    case 'FUZZ' :
        this.distortion.wet.value += value / 100;
        this.distortion.wet.value = this._clamp(this.distortion.wet.value, 0, 1);
        break;
    case 'TELEPHONE' :
        this.telephone.wet.value += value / 100;
        this.telephone.wet.value = this._clamp(this.telephone.wet.value, 0, 1);
        break;
    case 'WOBBLE' :
        this.wobble.wet.value += value / 100;
        this.wobble.wet.value = this._clamp(this.wobble.wet.value, 0, 1);
        break;
    case 'ROBOTIC' :
        this.vocoder.wet.value += value / 100;
        this.vocoder.wet.value = this._clamp(this.vocoder.wet.value, 0, 1);
        break;

    }
};

AudioEngine.prototype._setPitchShift = function (value) {
    this.pitchEffectValue = value;

    var freq = this._getPitchRatio() * Tone.Frequency('C3').eval();
    this.vocoder.setCarrierOscFrequency(freq);

    if (!this.soundPlayers) {
        return;
    }

    var ratio = this._getPitchRatio();
    this._setPlaybackRateForAllSoundPlayers(ratio);

};

AudioEngine.prototype._setPlaybackRateForAllSoundPlayers = function (rate) {
    for (var i=0; i<this.soundPlayers.length; i++) {
        this.soundPlayers[i].setPlaybackRate(rate);
    }
};

AudioEngine.prototype._getPitchRatio = function () {
    return this.tone.intervalToFrequencyRatio(this.pitchEffectValue / 10);
};

AudioEngine.prototype.setInstrument = function (instrumentNum) {
    this.instrumentNum = instrumentNum;

    return Soundfont.instrument(Tone.context, this.instrumentNames[instrumentNum]).then(
        function (inst) {
            this.instrument = inst;
            this.instrument.connect(this.effectsNode);
        }.bind(this)
    );
};

AudioEngine.prototype.clearEffects = function () {
    this.delay.wet.value = 0;
    this.panner.pan.value = 0;
    this.reverb.wet.value = 0;
    this.distortion.wet.value = 0;
    this.vocoder.wet.value = 0;
    this.wobble.wet.value = 0;
    this.telephone.wet.value = 0;
    this._setPitchShift(0);

    this.effectsNode.gain.value = 1;
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

