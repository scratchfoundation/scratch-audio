const AudioNodeMock = require('./AudioNode');

class AudioTargetMock {
    constructor () {
        this.inputNode = new AudioNodeMock();
    }

    connect (target) {
        this.inputNode.connect(target.getInputNode());
    }

    getInputNode () {
        return this.inputNode;
    }

    getSoundPlayers () {
        return {};
    }
}

module.exports = AudioTargetMock;
