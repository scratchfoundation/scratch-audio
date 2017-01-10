var Tone = require('tone');
var Soundfont = require('soundfont-player');
var log = require('./log');


function InstrumentPlayer (outputNode) {
    this.outputNode = outputNode;

    // instrument names used by Musyng Kite soundfont, in order to
    // match scratch instruments
    this.instrumentNames = ['acoustic_grand_piano', 'electric_piano_1',
        'drawbar_organ', 'acoustic_guitar_nylon', 'electric_guitar_clean',
         'acoustic_bass', 'pizzicato_strings', 'cello', 'trombone', 'clarinet',
         'tenor_sax', 'flute', 'pan_flute', 'bassoon', 'choir_aahs', 'vibraphone',
         'music_box', 'steel_drums', 'marimba', 'lead_1_square', 'fx_4_atmosphere'];

    this.instruments = [];
}

InstrumentPlayer.prototype.playNoteForBeatsWithInstrument = function (note, beats, instrumentNum) {
    this.loadInstrument(instrumentNum)
        .then(() => {
            this.instruments[instrumentNum].play(
                note, Tone.context.currentTime, {duration : Number(beats)} // todo: need to use tempo here
            );
        });
}

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

module.exports = InstrumentPlayer;
