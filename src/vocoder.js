/*

This is a port of Jamison Dance's port of Chris Wilson's WebAudio vocoder:
https://github.com/jergason/Vocoder
https://github.com/cwilso/Vocoder

I have adapted it to use the ToneJs library, making it a Tone Effect that
can be added to an audio effects chain.

*/

/*

The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

var Tone = require('tone');

function Vocoder () {
    Tone.Effect.call(this);

    this.modulatorInput = new Tone.Gain();
    this.carrierInput = new Tone.Gain();
    this.outputGain = new Tone.Gain();

    this.oscillatorNode;

    this.vocoderBands = this.generateVocoderBands(55, 7040, 8);
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

    var FILTER_QUALITY = 6;  // The Q value for the carrier and modulator filters

    // Set up a high-pass filter to add back in the fricatives, etc.
    var hpFilter = new Tone.Filter(8000, 'highpass');
    this.modulatorInput.connect(hpFilter);
    hpFilter.connect(this.outputGain);

    for (var i=0; i<this.vocoderBands.length; i++) {

        // CREATE THE MODULATOR CHAIN
        // create the bandpass filter in the modulator chain
        var modulatorFilter = new Tone.Filter(this.vocoderBands[i].frequency, 'bandpass', -24);
        modulatorFilter.Q.value = FILTER_QUALITY;
        this.modulatorInput.connect(modulatorFilter);

        // create a post-filtering gain to bump the levels up.
        var modulatorFilterPostGain = new Tone.Gain(6);
        modulatorFilter.connect(modulatorFilterPostGain);

        // add a rectifier with a lowpass filter to turn the bandpass filtered signal
        // into a smoothed control signal to control the carrier filter
        var rectifier = new Tone.WaveShaper([1,0,1]);
        modulatorFilterPostGain.connect(rectifier);
        var rectifierLowPass = new Tone.Filter(50, 'lowpass');
        rectifier.connect(rectifierLowPass);

        // Create the bandpass filter in the carrier chain
        var carrierFilter = new Tone.Filter(this.vocoderBands[i].frequency, 'bandpass', -24);
        carrierFilter.Q.value = FILTER_QUALITY;
        this.carrierInput.connect(carrierFilter);

        var carrierFilterPostGain = new Tone.Gain(10);
        carrierFilter.connect(carrierFilterPostGain);

        // Create the carrier band gain node
        var bandGain = new Tone.Gain(0);
        carrierFilterPostGain.connect(bandGain);

        rectifierLowPass.connect(bandGain.gain);

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
