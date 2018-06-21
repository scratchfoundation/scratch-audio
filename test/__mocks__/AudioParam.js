class AudioParamMock {
    setTargetAtTime (value /* , start, stop */) {
        this.value = value;
    }
    setValueAtTime (value) {
        this.value = value;
    }
    linearRampToValueAtTime (value) {
        this.value = value;
    }
}

module.exports = AudioParamMock;
