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

// this function will algorithmically re-calculate vocoder bands, distributing evenly
// from startFreq to endFreq, splitting evenly (logarhythmically) into a given numBands.
// The function places this info into the vocoderBands and numVocoderBands variables.
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
        //console.log( "Band " + i + " centered at " + currentFreq + "Hz" );
        currentFreq = currentFreq * scale;
    }

    return vocoderBands;
};

Vocoder.prototype.initBandpassFilters = function () {

    var modFilterBands = new Array();           // tuned bandpass filters
    var modFilterPostGains = new Array();       // post-filter gains.
    var heterodynes = new Array();              // gain nodes used to multiply bandpass X sine
    var powers = new Array();                   // gain nodes used to multiply prev out by itself
    var lpFilters = new Array();                // tuned lowpass filters to remove doubled copy of product
    var lpFilterPostGains = new Array();        // gain nodes for tuning input to waveshapers
    var carrierBands = new Array();             // tuned bandpass filters, same as modFilterBands but in carrier chain
    var carrierFilterPostGains = new Array();   // post-bandpass gain adjustment
    var carrierBandGains = new Array();         // these are the "control gains" driven by the lpFilters

    var waveShaperCurve = new Float32Array(65536);
    // Populate with a "curve" that does an abs()
    var n = 65536;
    var n2 = n / 2;

    for (var i = 0; i < n2; ++i) {
        var x = i / n2;
        waveShaperCurve[n2 + i] = x;
        waveShaperCurve[n2 - i - 1] = x;
    }

    // Set up a high-pass filter to add back in the fricatives, etc.
    var hpFilter = Tone.context.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 8000;
    hpFilter.Q.value = 1; //  no peaking
    this.modulatorInput.connect( hpFilter);

    var hpFilterGain = Tone.context.createGain();
    hpFilterGain.gain.value = 1.0;

    hpFilter.connect(hpFilterGain);
    hpFilterGain.connect(this.outputGain);

    //clear the arrays
    modFilterBands.length = 0;
    modFilterPostGains.length = 0;
    heterodynes.length = 0;
    powers.length = 0;
    lpFilters.length = 0;
    lpFilterPostGains.length = 0;
    carrierBands.length = 0;
    carrierFilterPostGains.length = 0;
    carrierBandGains.length = 0;

    var rectifierCurve = new Float32Array(65536);
    for (i=-32768; i<32768; i++) {
        rectifierCurve[i+32768] = ((i>0)?i:-i)/32768;
    }

    for (i=0; i<this.vocoderBands.length; i++) {
        // CREATE THE MODULATOR CHAIN
        // create the bandpass filter in the modulator chain
        var modulatorFilter = Tone.context.createBiquadFilter();
        modulatorFilter.type = 'bandpass';  // Bandpass filter
        modulatorFilter.frequency.value = this.vocoderBands[i].frequency;
        modulatorFilter.Q.value = this.FILTER_QUALITY; //  initial quality
        this.modulatorInput.connect(modulatorFilter);
        modFilterBands.push(modulatorFilter);

        // Now, create a second bandpass filter tuned to the same frequency -
        // this turns our second-order filter into a 4th-order filter,
        // which has a steeper rolloff/octave
        var secondModulatorFilter = Tone.context.createBiquadFilter();
        secondModulatorFilter.type = 'bandpass';  // Bandpass filter
        secondModulatorFilter.frequency.value = this.vocoderBands[i].frequency;
        secondModulatorFilter.Q.value = this.FILTER_QUALITY; //  initial quality
        modulatorFilter.chainedFilter = secondModulatorFilter;
        modulatorFilter.connect(secondModulatorFilter);

        // create a post-filtering gain to bump the levels up.
        var modulatorFilterPostGain = Tone.context.createGain();
        modulatorFilterPostGain.gain.value = 6;
        secondModulatorFilter.connect(modulatorFilterPostGain);
        modFilterPostGains.push(modulatorFilterPostGain);

        // Create the sine oscillator for the heterodyne
        var heterodyneOscillator = Tone.context.createOscillator();
        heterodyneOscillator.frequency.value = this.vocoderBands[i].frequency;

        heterodyneOscillator.start(0);

        // Create the node to multiply the sine by the modulator
        var heterodyne = Tone.context.createGain();
        modulatorFilterPostGain.connect(heterodyne);
        heterodyne.gain.value = 0.0;  // audio-rate inputs are summed with initial intrinsic value
        heterodyneOscillator.connect(heterodyne.gain);

        var heterodynePostGain = Tone.context.createGain();
        heterodynePostGain.gain.value = 2.0;    // GUESS:  boost
        heterodyne.connect(heterodynePostGain);
        heterodynes.push(heterodynePostGain);


        // Create the rectifier node
        var rectifier = Tone.context.createWaveShaper();
        rectifier.curve = rectifierCurve;
        heterodynePostGain.connect(rectifier);

        // Create the lowpass filter to mask off the difference (near zero)
        var lpFilter = Tone.context.createBiquadFilter();
        lpFilter.type = "lowpass";  // Lowpass filter
        lpFilter.frequency.value = 5.0; // Guesstimate!  Mask off 20Hz and above.
        lpFilter.Q.value = 1; // don't need a peak
        lpFilters.push(lpFilter);
        rectifier.connect(lpFilter);

        var lpFilterPostGain = Tone.context.createGain();
        lpFilterPostGain.gain.value = 1.0;
        lpFilter.connect(lpFilterPostGain);
        lpFilterPostGains.push(lpFilterPostGain);

        var waveshaper = Tone.context.createWaveShaper();
        waveshaper.curve = waveShaperCurve;
        lpFilterPostGain.connect(waveshaper);


        // Create the bandpass filter in the carrier chain
        var carrierFilter = Tone.context.createBiquadFilter();
        carrierFilter.type = 'bandpass';
        carrierFilter.frequency.value = this.vocoderBands[i].frequency;
        carrierFilter.Q.value = this.FILTER_QUALITY;
        carrierBands.push(carrierFilter);
        this.carrierInput.connect(carrierFilter);

        // We want our carrier filters to be 4th-order filter too.
        var secondCarrierFilter = Tone.context.createBiquadFilter();
        secondCarrierFilter.type = 'bandpass';  // Bandpass filter
        secondCarrierFilter.frequency.value = this.vocoderBands[i].frequency;
        secondCarrierFilter.Q.value = this.FILTER_QUALITY; //  initial quality
        carrierFilter.chainedFilter = secondCarrierFilter;
        carrierFilter.connect(secondCarrierFilter);

        var carrierFilterPostGain = Tone.context.createGain();
        carrierFilterPostGain.gain.value = 10.0;
        secondCarrierFilter.connect(carrierFilterPostGain);
        carrierFilterPostGains.push(carrierFilterPostGain);

        // Create the carrier band gain node
        var bandGain = Tone.context.createGain();
        carrierBandGains.push(bandGain);
        carrierFilterPostGain.connect(bandGain);
        bandGain.gain.value = 0.0;  // audio-rate inputs are summed with initial intrinsic value
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
