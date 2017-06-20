const Soundfont = require('soundfont-player');

class InstrumentPlayer {
    /**
     * A prototype for the instrument sound functionality that can play notes.
     * This prototype version (which will be replaced at some point) uses an
     * existing soundfont library that creates several limitations:
     * The sound files are high quality but large, so they are loaded 'on demand,' at the time the
     * play note or set instrument block runs, causing a delay of a few seconds.
     * Using this library we don't have a way to set the volume, sustain the note beyond the sample
     * duration, or run it through the sprite-specific audio effects.
     * @param {AudioNode} outputNode - a webAudio node that the instrument will send its output to
     * @constructor
     */
    constructor (context) {
        this.context = context;
        this.outputNode = null;

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
     * @param  {number} vol - a volume level (0-100%)
     */
    playNoteForSecWithInstAndVol (note, sec, instrumentNum, vol) {
        const gain = vol / 100;
        this.loadInstrument(instrumentNum)
            .then(() => {
                this.instruments[instrumentNum].play(
                    note, this.context.currentTime, {
                        duration: sec,
                        gain: gain
                    }
                );
            });
    }

    /**
     * Load an instrument by number
     * @param  {number} instrumentNum - an instrument number (0-indexed)
     * @return {Promise} a Promise that resolves once the instrument audio data has been loaded
     */
    loadInstrument (instrumentNum) {
        if (this.instruments[instrumentNum]) {
            return Promise.resolve();
        }
        return Soundfont.instrument(this.context, this.instrumentNames[instrumentNum])
                .then(inst => {
                    inst.connect(this.outputNode);
                    this.instruments[instrumentNum] = inst;
                });

    }

    /**
     * Stop all notes being played on all instruments
     */
    stopAll () {
        for (let i = 0; i < this.instruments.length; i++) {
            if (this.instruments[i]) {
                this.instruments[i].stop();
            }
        }
    }
}

module.exports = InstrumentPlayer;
