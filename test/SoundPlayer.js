/* global Uint8Array */
const tap = require('tap');
const {AudioContext} = require('web-audio-test-api');

const AudioEngine = require('../src/AudioEngine');


tap.test('SoundPlayer', suite => {

    let audioContext;
    let audioEngine;
    let soundPlayer;

    suite.beforeEach(async () => {
        audioContext = new AudioContext();
        audioEngine = new AudioEngine(audioContext);
        audioEngine.DECODE_AUDIO_DATA_RESULT = audioContext.createBuffer(2, 1024, 44100);
        const data = new Uint8Array(1024);
        soundPlayer = await audioEngine.decodeSoundPlayer({data});
    });

    suite.afterEach(() => {
        soundPlayer.dispose();
        soundPlayer = null;
        audioEngine = null;
        audioContext.$reset();
        audioContext = null;
    });

    suite.plan(3);

    suite.test('play initializes and creates chain', t => {
        t.plan(3);
        t.equal(soundPlayer.initialized, false, 'not yet initialized');
        soundPlayer.play();
        t.equal(soundPlayer.initialized, true, 'now is initialized');
        let buffer = audioEngine.DECODE_AUDIO_DATA_RESULT.toJSON();
        t.deepEqual(soundPlayer.outputNode.toJSON(), {
            buffer,
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
        t.deepEqual(audioEngine.inputNode.toJSON().inputs, [
            soundPlayer.outputNode.toJSON()
        ], 'output node connects to input node');
        t.end();
    });

    suite.test('stop decay', t => {
        t.plan(6);
        soundPlayer.play();
        soundPlayer.connect(audioEngine);

        audioContext.$processTo(0);
        soundPlayer.stop();
        t.deepEqual(audioEngine.inputNode.toJSON().inputs, [{
            name: 'GainNode',
            gain: {
                value: 1,
                inputs: []
            },
            inputs: [soundPlayer.outputNode.toJSON()]
        }], 'output node connects to gain node to input node');

        audioContext.$processTo(audioEngine.DECAY_TIME / 2);
        const engineInputs = audioEngine.inputNode.toJSON().inputs;
        t.notEqual(engineInputs[0].gain.value, 1, 'gain value should not be 1');
        t.notEqual(engineInputs[0].gain.value, 0, 'gain value should not be 0');
        t.equal(soundPlayer.outputNode.$state, 'PLAYING');

        audioContext.$processTo(audioEngine.DECAY_TIME);
        t.deepEqual(audioEngine.inputNode.toJSON().inputs, [{
            name: 'GainNode',
            gain: {
                value: 0,
                inputs: []
            },
            inputs: [soundPlayer.outputNode.toJSON()]
        }], 'output node connects to gain node to input node decayed');

        t.equal(soundPlayer.outputNode.$state, 'FINISHED');

        t.end();
    });

    suite.end();
});
