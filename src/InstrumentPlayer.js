var Tone = require('tone');
var Soundfont = require('soundfont-player');

/**
 * A prototype for the instrument sound functionality that can play notes.
 * This prototype version (which will be replaced at some point) uses an
 * existing soundfont library that creates several limitations:
 * The sound files are high quality but large, so they are loaded 'on demand,' at the time the
 * play note or set instrument block runs, causing a delay of a few seconds.
 * Using this library we don't have a way to set the volume, sustain the note beyond the sample
 * duration, or run it through the sprite-specific audio effects.
 * @param {Tone.Gain} outputNode - a webAudio node that the instrument will send its output to
 * @constructor
 */
function InstrumentPlayer (outputNode) {
    this.outputNode = outputNode;

    // Instrument names used by Musyng Kite soundfont, in order to
    // match scratch instruments
    this.instrumentNames = ['acoustic_grand_piano', 'electric_piano_1',
        'drawbar_organ', 'acoustic_guitar_nylon', 'electric_guitar_clean',
         'acoustic_bass', 'pizzicato_strings', 'cello', 'trombone', 'clarinet',
         'tenor_sax', 'flute', 'pan_flute', 'bassoon', 'choir_aahs', 'vibraphone',
         'music_box', 'steel_drums', 'marimba', 'lead_1_square', 'fx_4_atmosphere'];

    this.instruments = [];
}

/**
 * Play a note for some number of seconds with a particular instrument.
 * Load the instrument first, if it has not already been loaded.
 * The duration is in seconds because the AudioEngine manages the tempo,
 * and converts beats to seconds.
 * @param  {number} note - a MIDI note number
 * @param  {number} sec - a duration in seconds
 * @param  {number} instrumentNum - an instrument number (0-indexed)
 */
InstrumentPlayer.prototype.playNoteForSecWithInst = function (note, sec, instrumentNum) {
    this.loadInstrument(instrumentNum)
        .then(() => {
            this.instruments[instrumentNum].play(
                note, Tone.context.currentTime, {duration : sec}
            );
        });
};

/**
 * Load an instrument by number
 * @param  {number} instrumentNum - an instrument number (0-indexed)
 * @return {Promise} a Promise that resolves once the instrument audio data has been loaded
 */
InstrumentPlayer.prototype.loadInstrument = function (instrumentNum) {
    if (this.instruments[instrumentNum]) {
        return Promise.resolve();
    } else {
        return Soundfont.instrument(Tone.context, this.instrumentNames[instrumentNum])
            .then((inst) => {
                inst.connect(this.outputNode);
                this.instruments[instrumentNum] = inst;
            });
    }
};

/**
 * Stop all notes being played on all instruments
 */
InstrumentPlayer.prototype.stopAll = function () {
    for (var i=0; i<this.instruments.length; i++) {
        if (this.instruments[i]) {
            this.instruments[i].stop();
        }
    }
};

module.exports = InstrumentPlayer;
