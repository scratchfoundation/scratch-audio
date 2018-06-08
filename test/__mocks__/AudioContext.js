const AudioNodeMock = require('./AudioNode');
const AudioParamMock = require('./AudioParam');

class AudioContextMock {
    createGain () {
        return new AudioNodeMock({
            gain: new AudioParamMock({
                default: 1,
                min: -3,
                max: 3
            })
        });
    }

    createChannelMerger () {
        return new AudioNodeMock();
    }
}

module.exports = AudioContextMock;
