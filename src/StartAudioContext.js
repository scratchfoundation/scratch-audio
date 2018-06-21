// StartAudioContext assumes that we are in a window/document setting and messes with the unit
// tests, this is our own version just checking to see if we have a global document to listen
// to before we even try to "start" it.  Our test api audio context is started by default.
const StartAudioContext = require('startaudiocontext');

module.exports = function (context) {
    if (typeof document !== 'undefined') {
        return StartAudioContext(context);
    }
};
