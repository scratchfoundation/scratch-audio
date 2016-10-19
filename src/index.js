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
    this.pitchShiftRatio;

    // reset effects to their default parameters
    this.clearEffects();

    // the effects are chained to an effects node for this clone, then to the master output
    // so audio is sent from each sampler or instrument, through the effects in order, then out
    // note that the pitch effect works differently - it sets the playback rate for each sampler
    this.effectsNode = new Tone.Gain();
    this.effectsNode.chain(this.delay, this.panner, this.reverb, Tone.Master);

    // drum sounds

    // var drumFileNames = ['high_conga', 'small_cowbell',
    // 'snare_drum', 'splash cymbal'];
    // this.drumSamplers = this._loadSoundFiles(drumFileNames);

    // sound urls - map each url to its tone.sampler
    this.soundSamplers = [];
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

    // theremin setup

    this.theremin = new Tone.Synth();
    this.portamentoTime = 0.25;
    this.theremin.portamento = this.portamentoTime;
    this.thereminVibrato = new Tone.Vibrato(4, 0.5);
    this.theremin.chain(this.thereminVibrato, this.effectsNode);
    this.thereminTimeout;
    this.thereminIsPlaying = false;
}

AudioEngine.prototype.loadSounds = function (sounds) {
    for (var i=0; i<sounds.length; i++) {
        var url = sounds[i].fileUrl;
        // skip adpcm form sounds since we can't load them yet
        if (sounds[i].format == 'adpcm') {
            continue;
        }
        var sampler = new Tone.Sampler(url);
        sampler.connect(this.effectsNode);
        // this.soundSamplers.push(sampler);
        this.soundSamplers[i] = sampler;
    }
};

AudioEngine.prototype.playSound = function (index) {
    this.soundSamplers[index].triggerAttack();
    this.soundSamplers[index].player.playbackRate = 1 + this.pitchShiftRatio;

};

AudioEngine.prototype.getSoundDuration = function (index) {
    return this.soundSamplers[index].player.buffer.duration;
};

AudioEngine.prototype.playNoteForBeats = function (note, beats) {
    this.instrument.play(
        note, Tone.context.currentTime, {duration : Number(beats)}
    );
};

AudioEngine.prototype.playThereminForBeats = function (note, beats) {
    // if the theremin is playing
    //      set frequency
    // else
    //      trigger attack
    // create a timeout for slightly longer than the duration of the block
    // that releases the theremin - so we can slide continuously between
    // successive notes without releasing and attacking

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
    // stop sounds triggered with playSound (indexed by their urls)
    for (var key in this.soundSamplers) {
        this.soundSamplers[key].triggerRelease();
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
        this._setPitchShift(value / 20);
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
        this._setPitchShift(this.pitchShiftRatio + (value / 20));
        break;
    }
};

AudioEngine.prototype._setPitchShift = function (value) {
    this.pitchShiftRatio = value;
    for (var i in this.soundSamplers) {
        this.soundSamplers[i].player.playbackRate = 1 + this.pitchShiftRatio;
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
};

AudioEngine.prototype._clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = AudioEngine;

