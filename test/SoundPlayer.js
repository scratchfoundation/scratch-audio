/* global Uint8Array Promise */
const tap = require('tap');
const {AudioContext} = require('web-audio-test-api');

const AudioEngine = require('../src/AudioEngine');


tap.test('SoundPlayer', suite => {

    let audioContext;
    let audioEngine;
    let soundPlayer;

    const help = {
        get engineInputs () {
            return audioEngine.inputNode.toJSON().inputs;
        }
    };

    suite.beforeEach(() => {
        audioContext = new AudioContext();
        audioEngine = new AudioEngine(audioContext);
        // sound will be 0.2 seconds long
        audioContext.DECODE_AUDIO_DATA_RESULT = audioContext.createBuffer(2, 8820, 44100);
        audioContext.DECODE_AUDIO_DATA_FAILED = false;
        const data = new Uint8Array(0);
        return audioEngine.decodeSoundPlayer({data}).then(result => {
            soundPlayer = result;
        });
    });

    suite.afterEach(() => {
        soundPlayer.dispose();
        soundPlayer = null;
        audioEngine = null;
        audioContext.$reset();
        audioContext = null;
    });

    suite.plan(5);

    suite.test('play initializes and creates source node', t => {
        t.plan(3);
        t.equal(soundPlayer.initialized, false, 'not yet initialized');
        soundPlayer.play();
        t.equal(soundPlayer.initialized, true, 'now is initialized');
        t.deepEqual(soundPlayer.outputNode.toJSON(), {
            buffer: audioContext.DECODE_AUDIO_DATA_RESULT.toJSON(),
            inputs: [],
            loop: false,
            loopEnd: 0,
            loopStart: 0,
            name: 'AudioBufferSourceNode',
            playbackRate: {
                inputs: [],
                value: 1
            }
        });

        t.end();
    });

    suite.test('connect', t => {
        t.plan(1);
        soundPlayer.play();
        soundPlayer.connect(audioEngine);
        t.deepEqual(help.engineInputs, [
            soundPlayer.outputNode.toJSON()
        ], 'output node connects to input node');
        t.end();
    });

    suite.test('stop decay', t => {
        t.plan(5);
        soundPlayer.play();
        soundPlayer.connect(audioEngine);
        const outputNode = soundPlayer.outputNode;

        audioContext.$processTo(0);
        soundPlayer.stop();
        t.equal(soundPlayer.outputNode, null, 'nullify outputNode immediately (taken sound is stopping)');
        t.deepEqual(help.engineInputs, [{
            name: 'GainNode',
            gain: {
                value: 1,
                inputs: []
            },
            inputs: [outputNode.toJSON()]
        }], 'output node connects to gain node to input node');

        audioContext.$processTo(audioEngine.DECAY_DURATION / 2);
        t.equal(outputNode.$state, 'PLAYING');

        audioContext.$processTo(audioEngine.DECAY_DURATION + 0.001);
        t.deepEqual(help.engineInputs, [{
            name: 'GainNode',
            gain: {
                value: 0,
                inputs: []
            },
            inputs: [outputNode.toJSON()]
        }], 'output node connects to gain node to input node decayed');

        t.equal(outputNode.$state, 'FINISHED');

        t.end();
    });

    suite.test('play while playing debounces', t => {
        t.plan(7);
        const log = [];
        soundPlayer.connect(audioEngine);
        soundPlayer.play();
        t.equal(soundPlayer.isStarting, true, 'player.isStarting');
        const originalNode = soundPlayer.outputNode;
        // the second play should still "finish" this play
        soundPlayer.finished().then(() => log.push('finished first'));
        soundPlayer.play();
        soundPlayer.finished().then(() => log.push('finished second'));
        soundPlayer.play();
        soundPlayer.finished().then(() => log.push('finished third'));
        soundPlayer.play();
        t.equal(originalNode, soundPlayer.outputNode, 'same output node');
        t.equal(soundPlayer.outputNode.$state, 'PLAYING');
        return Promise.resolve().then(() => {
            t.deepEqual(log, ['finished first', 'finished second', 'finished third'], 'finished in order');

            // fast forward to one ms before decay time
            audioContext.$processTo(audioEngine.DECAY_DURATION - 0.001);
            soundPlayer.play();

            t.equal(originalNode, soundPlayer.outputNode, 'same output node');


            // now at DECAY_DURATION, we should meet a new player as the old one is taken/stopped
            audioContext.$processTo(audioEngine.DECAY_DURATION);

            t.equal(soundPlayer.isStarting, false, 'player.isStarting now false');

            soundPlayer.play();
            t.notEqual(originalNode, soundPlayer.outputNode, 'New output node');

            t.end();
        });

    });

    suite.test('play while playing', t => {
        t.plan(15);
        const log = [];
        soundPlayer.play();
        soundPlayer.finished().then(() => log.push('play 1 finished'));
        soundPlayer.connect(audioEngine);
        const firstPlayNode = soundPlayer.outputNode;

        // go past debounce time and play again
        audioContext.$processTo(audioEngine.DECAY_DURATION);

        return Promise.resolve()
        .then(() => {

            t.equal(soundPlayer.outputNode.$state, 'PLAYING');

            soundPlayer.play();
            soundPlayer.finished().then(() => log.push('play 2 finished'));

            // wait for a micro-task loop to fire our previous events
            return Promise.resolve();
        })
        .then(() => {

            t.equal(log[0], 'play 1 finished');
            t.notEqual(soundPlayer.outputNode, firstPlayNode, 'created new player node');

            t.equal(help.engineInputs.length, 2, 'there should be 2 players connected');
            t.equal(firstPlayNode.$state, 'PLAYING');
            t.equal(soundPlayer.outputNode.$state, 'PLAYING');
            t.equal(help.engineInputs[0].gain.value, 1, 'old sound connectect to gain node with volume 1');

            const {currentTime} = audioContext;
            audioContext.$processTo(currentTime + audioEngine.DECAY_WAIT + 0.001);
            t.notEqual(help.engineInputs[0].gain.value, 1,
            'old sound connected to gain node which will fade');

            audioContext.$processTo(currentTime + audioEngine.DECAY_WAIT + audioEngine.DECAY_DURATION + 0.001);
            t.equal(soundPlayer.outputNode.$state, 'PLAYING');
            t.equal(firstPlayNode.$state, 'FINISHED');

            t.equal(help.engineInputs[0].gain.value, 0, 'faded old sound to 0');

            t.equal(log.length, 1);
            audioContext.$processTo(currentTime + audioEngine.DECAY_WAIT + audioEngine.DECAY_DURATION + 0.3);

            // wait for a micro-task loop to fire our previous events
            return Promise.resolve();
        })
        .then(() => {

            t.equal(log[1], 'play 2 finished');
            t.equal(help.engineInputs.length, 1, 'old sound disconneted itself after done');
            t.equal(log.length, 2);

            t.end();
        });
    });

    suite.end();
});
