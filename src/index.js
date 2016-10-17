var Tone = require('tone');
var Soundfont = require('soundfont-player');

function AudioEngine (sounds) {

    // tone setup

    this.tone = new Tone();

	// effects setup

    this.delay = new Tone.FeedbackDelay(0.25, 0.5);
    this.panner = new Tone.Panner();
    this.reverb = new Tone.Freeverb();

    this.clearEffects();

    Tone.Master.chain(this.delay, this.panner, this.reverb);

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
         'acoustic_bass', 'pizzicato_strings', 'cello', 'trombone', 'clarinet'];

    Soundfont.instrument(Tone.context, this.instrumentNames[0]).then(
        function (inst) {
            this.instrument = inst;
            this.instrument.connect(Tone.Master);
        }.bind(this)
    );
}

AudioEngine.prototype.loadSounds = function (sounds) {
    for (var i=0; i<sounds.length; i++) {
        var url = sounds[i].fileUrl;
        var sampler = new Tone.Sampler(url).toMaster();
        this.soundSamplers.push(sampler);
    }
};

AudioEngine.prototype.playSound = function (index) {
    this.soundSamplers[index].triggerAttack();
};

AudioEngine.prototype.getSoundDuration = function (index) {
    return this.soundSamplers[index].player.buffer.duration;
};

AudioEngine.prototype.playNoteForBeats = function (note, beats) {
    this.instrument.play(
        note, Tone.context.currentTime, {duration : Number(beats)}
    );
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
        break;
    }
};

AudioEngine.prototype._setPitchShift = function (value) {
    for (var i in this.soundSamplers) {
        this.soundSamplers[i].player.playbackRate = 1 + value;
    }
};

AudioEngine.prototype.clearEffects = function () {
    this.delay.wet.value = 0;
    this._setPitchShift(0);
    this.panner.pan.value = 0;
    this.reverb.wet.value = 0;
};

// AudioEngine.prototype.loadSoundFromUrl = function(url) {

// };

AudioEngine.prototype._clamp = function (input, min, max) {
    return Math.min(Math.max(input, min), max);
};

module.exports = AudioEngine;

