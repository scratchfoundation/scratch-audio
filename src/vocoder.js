/*

*/

var Tone = require('tone');

function Vocoder () {
    Tone.Effect.call(this);

    this.FILTER_QUALITY = 6;  // The Q value for the carrier and modulator filters

    this.modulatorInput = new Tone.Gain();
    this.carrierInput = new Tone.Gain();
    this.outputGain = new Tone.Gain();

    this.oscillatorNode;

    this.vocoderBands = this.generateVocoderBands(55, 7040, 10);
    this.initBandpassFilters();
    this.createCarrier();

    this.effectSend.connect(this.modulatorInput);
    this.outputGain.connect(this.effectReturn);
}

Tone.extend(Vocoder, Tone.Effect);

Vocoder.prototype.setCarrierOscFrequency = function (freq) {
    this.oscillatorNode.frequency.rampTo(freq, 0.05);
};

// this function algorithmically calculates vocoder bands, distributing evenly
// from startFreq to endFreq, splitting evenly (logarhythmically) into a given numBands.
Vocoder.prototype.generateVocoderBands = function (startFreq, endFreq, numBands) {
    // Remember: 1200 cents in octave, 100 cents per semitone

    var totalRangeInCents = 1200 * Math.log( endFreq / startFreq ) / Math.LN2;
    var centsPerBand = totalRangeInCents / numBands;
    var scale = Math.pow( 2, centsPerBand / 1200 );  // This is the scaling for successive bands

    var vocoderBands = [];
    var currentFreq = startFreq;

    for (var i=0; i<numBands; i++) {
        vocoderBands[i] = new Object();
        vocoderBands[i].frequency = currentFreq;
        currentFreq = currentFreq * scale;
    }

    return vocoderBands;
};

Vocoder.prototype.initBandpassFilters = function () {

    // Set up a high-pass filter to add back in the fricatives, etc.
    var hpFilter = new Tone.Filter(8000, 'highpass');
    this.modulatorInput.connect(hpFilter);
    hpFilter.connect(this.outputGain);

    for (var i=0; i<this.vocoderBands.length; i++) {

        // CREATE THE MODULATOR CHAIN
        // create the bandpass filter in the modulator chain
        var modulatorFilter = new Tone.Filter(this.vocoderBands[i].frequency, 'bandpass', -24);
        modulatorFilter.Q.value = this.FILTER_QUALITY;
        this.modulatorInput.connect(modulatorFilter);

        // create a post-filtering gain to bump the levels up.
        var modulatorFilterPostGain = new Tone.Gain();
        modulatorFilterPostGain.gain.value = 6;
        modulatorFilter.connect(modulatorFilterPostGain);

        // Create the sine oscillator for the heterodyne
        var heterodyneOscillator = new Tone.Oscillator(this.vocoderBands[i].frequency).start();

        // Create the node to multiply the sine by the modulator
        var heterodyne = new Tone.Gain(0); // audio-rate inputs are summed with initial intrinsic value
        modulatorFilterPostGain.connect(heterodyne);
        heterodyneOscillator.connect(heterodyne.gain);

        var heterodynePostGain = new Tone.Gain(2.0);
        heterodyne.connect(heterodynePostGain);

        // Create the rectifier node
        var rectifier = new Tone.WaveShaper([1, 0, 1]);
        heterodynePostGain.connect(rectifier);

        // Create the lowpass filter to mask off the difference (near zero)
        var lpFilter = new Tone.Filter(5, 'lowpass');
        lpFilter.Q.value = 1; // don't need a peak
        rectifier.connect(lpFilter);

        var lpFilterPostGain = new Tone.Gain();
        lpFilterPostGain.gain.value = 1.0;
        lpFilter.connect(lpFilterPostGain);

        var waveshaper = new Tone.WaveShaper([1, 0, 1]);
        lpFilterPostGain.connect(waveshaper);

        // Create the bandpass filter in the carrier chain
        var carrierFilter = new Tone.Filter(this.vocoderBands[i].frequency, 'bandpass', -24);
        carrierFilter.Q.value = this.FILTER_QUALITY;
        this.carrierInput.connect(carrierFilter);

        var carrierFilterPostGain = new Tone.Gain(10);
        carrierFilter.connect(carrierFilterPostGain);

        // Create the carrier band gain node
        var bandGain = new Tone.Gain(0); // audio-rate inputs are summed with initial intrinsic value
        carrierFilterPostGain.connect(bandGain);
        waveshaper.connect(bandGain.gain);  // connect the lp controller

        bandGain.connect(this.outputGain);
    }
};

Vocoder.prototype.createCarrier = function () {
    this.oscillatorNode = new Tone.Oscillator('C3', 'sawtooth').start();
    this.oscillatorNode.connect(this.carrierInput);

    var noiseNode = new Tone.Noise('white').start();
    noiseNode.volume.value = -12;
    noiseNode.connect(this.carrierInput);
};

module.exports = Vocoder;
