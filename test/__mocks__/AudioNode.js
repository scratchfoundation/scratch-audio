class AudioNodeMock {
    constructor (params) {
        Object.assign(this, params);

        this.connected = null;
        this.connectedFrom = [];
        this._testResult = [];
    }

    connect (node) {
        this.connected = node;
        node.connectedFrom.push(this);
    }

    disconnect () {
        if (this.connected !== null) {
            this.connectedFrom = this.connectedFrom.filter(connection => connection !== this);
        }
        this.connected = null;
    }

    _test (test, message, depth = 0) {
        if (this.connected === null) {
            this._testResult.push({test, message, depth});
        } else {
            this.connected._test(test, message, depth + 1);
            this._testResult.push(null);
        }
    }

    _result () {
        return this._testResult.pop();
    }
}

module.exports = AudioNodeMock;
