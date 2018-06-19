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

    suite.beforeEach(async () => {
        audioContext = new AudioContext();
        audioEngine = new AudioEngine(audioContext);
        // sound will be 0.1 seconds long
        audioContext.DECODE_AUDIO_DATA_RESULT = audioContext.createBuffer(2, 4410, 44100);
        audioContext.DECODE_AUDIO_DATA_FAILED = false;
        const data = new Uint8Array(44100);
        soundPlayer = await audioEngine.decodeSoundPlayer({data});
    });

    suite.afterEach(() => {
        soundPlayer.dispose();
        soundPlayer = null;
        audioEngine = null;
        audioContext.$reset();
        audioContext = null;
    });

    suite.plan(4);

    suite.test('play initializes and creates chain', t => {
        t.plan(3);
        t.equal(soundPlayer.initialized, false, 'not yet initialized');
        soundPlayer.play();
        t.equal(soundPlayer.initialized, true, 'now is initialized');
        let buffer = audioContext.DECODE_AUDIO_DATA_RESULT.toJSON();
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

    suite.test('play while playing', async t => {
        t.plan(14);
        const log = [];
        soundPlayer.play();
        soundPlayer.finished().then(() => log.push('play 1 finished'));
        soundPlayer.connect(audioEngine);


        audioContext.$processTo(0.005);
        t.equal(soundPlayer.outputNode.$state, 'PLAYING');

        const oldPlayerNode = soundPlayer.outputNode;
        soundPlayer.play();
        soundPlayer.finished().then(() => log.push('play 2 finished'));

        // wait for a micro-task loop to fire our previous events
        await Promise.resolve();
        t.equal(log[0], 'play 1 finished');
        t.notEqual(soundPlayer.outputNode, oldPlayerNode, 'created new player node');

        t.equal(help.engineInputs.length, 2, 'there should be 2 players connected');
        t.equal(oldPlayerNode.$state, 'PLAYING');
        t.equal(soundPlayer.outputNode.$state, 'PLAYING');
        t.equal(help.engineInputs[0].gain.value, 1, 'old sound connectect to gain node with volume 1');

        audioContext.$processTo(audioContext.currentTime + 0.001);
        t.notEqual(help.engineInputs[0].gain.value, 1,
            'old sound connected to gain node which will fade');

        audioContext.$processTo(audioContext.currentTime + audioEngine.DECAY_TIME + 0.001);
        t.equal(soundPlayer.outputNode.$state, 'PLAYING');
        t.equal(oldPlayerNode.$state, 'FINISHED');

        t.equal(help.engineInputs[0].gain.value, 0, 'faded old sound to 0');

        t.equal(log.length, 1);
        audioContext.$processTo(audioContext.currentTime + 0.2);

        await Promise.resolve();
        t.equal(log[1], 'play 2 finished');
        t.equal(log.length, 2);

        t.end();
    });

    suite.end();
});
