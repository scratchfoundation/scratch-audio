const AudioContextMock = require('./AudioContext');
const AudioTargetMock = require('./AudioTarget');

class AudioEngineMock extends AudioTargetMock {
    constructor () {
        super();

        this.audioContext = new AudioContextMock();
    }
}

module.exports = AudioEngineMock;
