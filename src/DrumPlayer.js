const SoundPlayer = require('./SoundPlayer');

class DrumPlayer {
    /**
     * A prototype for the drum sound functionality that can load drum sounds, play, and stop them.
     * @param {AudioContext} context - a webAudio context
     * @constructor
     */
    constructor (context) {
        this.context = context;

        const baseUrl = 'https://raw.githubusercontent.com/LLK/scratch-audio/develop/sound-files/drums/';
        const fileNames = [
            'SnareDrum(1)',
            'BassDrum(1b)',
            'SideStick(1)',
            'Crash(2)',
            'HiHatOpen(2)',
            'HiHatClosed(1)',
            'Tambourine(3)',
            'Clap(1)',
            'Claves(1)',
            'WoodBlock(1)',
            'Cowbell(3)',
            'Triangle(1)',
            'Bongo',
            'Conga(1)',
            'Cabasa(1)',
            'GuiroLong(1)',
            'Vibraslap(1)',
            'Cuica(2)'
        ];

        this.drumSounds = [];

        for (let i = 0; i < fileNames.length; i++) {
            this.drumSounds[i] = new SoundPlayer(this.context);

            // download and decode the drum sounds
            // @todo: use scratch-storage to manage these sound files
            const url = `${baseUrl}${fileNames[i]}_22k.wav`;
            const request = new XMLHttpRequest();
            request.open('GET', url, true);
            request.responseType = 'arraybuffer';
            request.onload = () => {
                const audioData = request.response;
                this.context.decodeAudioData(audioData).then(buffer => {
                    this.drumSounds[i].setBuffer(buffer);
                });
            };
            request.send();
        }
    }

    /**
     * Play a drum sound.
     * The parameter for output node allows sprites or clones to send the drum sound
     * to their individual audio effect chains.
     * @param  {number} drum - the drum number to play (0-indexed)
     * @param  {AudioNode} outputNode - a node to send the output to
     */
    play (drum, outputNode) {
        this.drumSounds[drum].connect(outputNode);
        this.drumSounds[drum].start();
    }

    /**
     * Stop all drum sounds.
     */
    stopAll () {
        for (let i = 0; i < this.drumSounds.length; i++) {
            this.drumSounds[i].stop();
        }
    }
}

module.exports = DrumPlayer;
