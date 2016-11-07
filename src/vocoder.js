var Tone = require('tone');

var modulatorNode = null;
var carrierNode = null;
var vocoding = false;

var FILTER_QUALITY = 6;  // The Q value for the carrier and modulator filters

// These are "placeholder" gain nodes - because the modulator and carrier will get swapped in
// as they are loaded, it's easier to connect these nodes to all the bands, and the "real"
// modulator & carrier AudioBufferSourceNodes connect to these.
var modulatorInput = null;
var carrierInput = null;

var modulatorGain = null;
var modulatorGainValue = 1.0;

// noise node added to the carrier signal
var noiseBuffer = null;
var noiseNode = null;
var noiseGain = null;
var noiseGainValue = 0.2;

// Carrier Synth oscillator stuff
var oscillatorNode = null;
var oscillatorType = 4;   // CUSTOM
var oscillatorGain = null;
var oscillatorGainValue = 1.0;
var oscillatorDetuneValue = 0;
var FOURIER_SIZE = 4096;
var SAWTOOTHBOOST = 0.40;

// These are the arrays of nodes - the "columns" across the frequency band "rows"
var modFilterBands = null;    // tuned bandpass filters
var modFilterPostGains = null;  // post-filter gains.
var heterodynes = null;   // gain nodes used to multiply bandpass X sine
var powers = null;      // gain nodes used to multiply prev out by itself
var lpFilters = null;   // tuned LP filters to remove doubled copy of product
var lpFilterPostGains = null;   // gain nodes for tuning input to waveshapers
var carrierBands = null;  // tuned bandpass filters, same as modFilterBands but in carrier chain
var carrierFilterPostGains = null;  // post-bandpass gain adjustment
var carrierBandGains = null;  // these are the "control gains" driven by the lpFilters

var vocoderBands;
var numVocoderBands;

var hpFilterGain = null;

var outputGain;

function Vocoder() {
    Tone.Effect.call(this);

    outputGain = new Tone.Gain();

    this.generateVocoderBands(55, 7040, 28);
    this.initBandpassFilters();
    this.createCarrier();

    this.effectSend.connect(modulatorInput);
    outputGain.connect(this.effectReturn);
}

Tone.extend(Vocoder, Tone.Effect);

// this function will algorithmically re-calculate vocoder bands, distributing evenly
// from startFreq to endFreq, splitting evenly (logarhythmically) into a given numBands.
// The function places this info into the vocoderBands and numVocoderBands variables.
Vocoder.prototype.generateVocoderBands = function (startFreq, endFreq, numBands) {
    // Remember: 1200 cents in octave, 100 cents per semitone

    var totalRangeInCents = 1200 * Math.log( endFreq / startFreq ) / Math.LN2;
    var centsPerBand = totalRangeInCents / numBands;
    var scale = Math.pow( 2, centsPerBand / 1200 );  // This is the scaling for successive bands

    vocoderBands = [];
    var currentFreq = startFreq;

    for (var i=0; i<numBands; i++) {
      vocoderBands[i] = new Object();
      vocoderBands[i].frequency = currentFreq;
      //console.log( "Band " + i + " centered at " + currentFreq + "Hz" );
      currentFreq = currentFreq * scale;
    }

    numVocoderBands = numBands;
};

Vocoder.prototype.initBandpassFilters = function() {
    // When this function is called, the carrierNode and modulatorAnalyser
    // may not already be created.  Create placeholder nodes for them.
    modulatorInput = Tone.context.createGain();
    carrierInput = Tone.context.createGain();

    if (modFilterBands == null)
      modFilterBands = new Array();

    if (modFilterPostGains == null)
      modFilterPostGains = new Array();

    if (heterodynes == null)
      heterodynes = new Array();

    if (powers == null)
      powers = new Array();

    if (lpFilters == null)
      lpFilters = new Array();

    if (lpFilterPostGains == null)
      lpFilterPostGains = new Array();

    if (carrierBands == null)
      carrierBands = new Array();

    if (carrierFilterPostGains == null)
      carrierFilterPostGains = new Array();

    if (carrierBandGains == null)
      carrierBandGains = new Array();

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
    // (this isn't used by default in the "production" version, as I hid the slider)
    var hpFilter = Tone.context.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.value = 8000; // or use vocoderBands[numVocoderBands-1].frequency;
    hpFilter.Q.value = 1; //  no peaking
    modulatorInput.connect( hpFilter);

    hpFilterGain = Tone.context.createGain();
    hpFilterGain.gain.value = 0.0;

    hpFilter.connect( hpFilterGain );
    hpFilterGain.connect( outputGain );

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
    for (var i=-32768; i<32768; i++)
      rectifierCurve[i+32768] = ((i>0)?i:-i)/32768;

    for (var i=0; i<numVocoderBands; i++) {
      // CREATE THE MODULATOR CHAIN
      // create the bandpass filter in the modulator chain
      var modulatorFilter = Tone.context.createBiquadFilter();
      modulatorFilter.type = "bandpass";  // Bandpass filter
      modulatorFilter.frequency.value = vocoderBands[i].frequency;
      modulatorFilter.Q.value = FILTER_QUALITY; //  initial quality
      modulatorInput.connect(modulatorFilter);
      modFilterBands.push(modulatorFilter);

      // Now, create a second bandpass filter tuned to the same frequency -
      // this turns our second-order filter into a 4th-order filter,
      // which has a steeper rolloff/octave
      var secondModulatorFilter = Tone.context.createBiquadFilter();
      secondModulatorFilter.type = "bandpass";  // Bandpass filter
      secondModulatorFilter.frequency.value = vocoderBands[i].frequency;
      secondModulatorFilter.Q.value = FILTER_QUALITY; //  initial quality
      modulatorFilter.chainedFilter = secondModulatorFilter;
      modulatorFilter.connect(secondModulatorFilter);

      // create a post-filtering gain to bump the levels up.
      var modulatorFilterPostGain = Tone.context.createGain();
      modulatorFilterPostGain.gain.value = 6;
      secondModulatorFilter.connect(modulatorFilterPostGain);
      modFilterPostGains.push(modulatorFilterPostGain);

      // Create the sine oscillator for the heterodyne
      var heterodyneOscillator = Tone.context.createOscillator();
      heterodyneOscillator.frequency.value = vocoderBands[i].frequency;

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
      carrierFilter.type = "bandpass";
      carrierFilter.frequency.value = vocoderBands[i].frequency;
      carrierFilter.Q.value = FILTER_QUALITY;
      carrierBands.push(carrierFilter);
      carrierInput.connect(carrierFilter);

      // We want our carrier filters to be 4th-order filter too.
      var secondCarrierFilter = Tone.context.createBiquadFilter();
      secondCarrierFilter.type = "bandpass";  // Bandpass filter
      secondCarrierFilter.frequency.value = vocoderBands[i].frequency;
      secondCarrierFilter.Q.value = FILTER_QUALITY; //  initial quality
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

      bandGain.connect(outputGain);
    }
};

Vocoder.prototype.createCarrier = function () {
    oscillatorNode = new Tone.Oscillator(110, 'sawtooth8').start();
    oscillatorNode.connect(carrierInput);

    noiseNode = new Tone.Noise('white').start();
    noiseGain = new Tone.Gain(noiseGainValue);
    noiseNode.connect(noiseGain);
    noiseGain.connect(carrierInput);
  }

module.exports = Vocoder;
