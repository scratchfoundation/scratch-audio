const tap = require('tap');
const AudioEngine = require('../src/AudioEngine');

const {AudioContext} = require('web-audio-test-api');

tap.test('AudioEngine', t => {
    const audioEngine = new AudioEngine(new AudioContext());

    t.plan(1);
    t.deepEqual(audioEngine.inputNode.toJSON(), {
        gain: {
            inputs: [],
            value: 1
        },
        inputs: [],
        name: 'GainNode'
    }, 'JSON Representation of inputNode');
});
