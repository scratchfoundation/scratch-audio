const Effect = require('./Effect');

/**
 * A pitch change effect, which changes the playback rate of the sound in order
 * to change its pitch: reducing the playback rate lowers the pitch, increasing
 * the rate raises the pitch. The duration of the sound is also changed.
 *
 * Changing the value of the pitch effect by 10 causes a change in pitch by 1
 * semitone (i.e. a musical half-step, such as the difference between C and C#)
 * Changing the pitch effect by 120 changes the pitch by one octave (12
 * semitones)
 *
 * The value of this effect is not clamped (i.e. it is typically between -120
 * and 120, but can be set much higher or much lower, with weird and fun
 * results). We should consider what extreme values to use for clamping it.
 *
 * Note that this effect functions differently from the other audio effects. It
 * is not part of a chain of audio nodes. Instead, it provides a way to set the
 * playback on one SoundPlayer or a group of them.
 */
class PitchEffect extends Effect {
    /**
     * @param {AudioEngine} audioEngine - audio engine this runs with
     * @param {AudioPlayer} audioPlayer - audio player this affects
     * @param {Effect} lastEffect - effect in the chain before this one
     * @constructor
     */
    constructor (audioEngine, audioPlayer, lastEffect) {
        super(audioEngine, audioPlayer, lastEffect);

        /**
         * The playback rate ratio
         * @type {Number}
         */
        this.ratio = 1;
    }

    /**
     * Return the name of the effect.
     * @type {string}
     */
    get name () {
        return 'pitch';
    }

    /**
     * Should the effect be connected to the audio graph?
     * @return {boolean} is the effect affecting the graph?
     */
    get _isPatch () {
        return false;
    }

    /**
     * Get the input node.
     * @return {AudioNode} - audio node that is the input for this effect
     */
    getInputNode () {
        return this.target.getInputNode();
    }

    /**
     * Initialize the Effect.
     * Effects start out uninitialized. Then initialize when they are first set
     * with some value.
     * @throws {Error} throws when left unimplemented
     */
    initialize () {
        this.initialized = true;
    }

    /**
     * Set the effect value.
     * @param {number} value - the new value to set the effect to
     */
    _set (value) {
        this.value = value;
        this.ratio = this.getRatio(this.value);
        this.updatePlayers(this.audioPlayer.getSoundPlayers());
    }

    /**
     * Update the effect for changes in the audioPlayer.
     */
    update () {
        this.updatePlayers(this.audioPlayer.getSoundPlayers());
    }

    /**
     * Compute the playback ratio for an effect value.
     * The playback ratio is scaled so that a change of 10 in the effect value
     * gives a change of 1 semitone in the ratio.
     * @param {number} val - an effect value
     * @returns {number} a playback ratio
     */
    getRatio (val) {
        const interval = val / 10;
        // Convert the musical interval in semitones to a frequency ratio
        return Math.pow(2, (interval / 12));
    }

    /**
     * Update a sound player's playback rate using the current ratio for the
     * effect
     * @param {object} player - a SoundPlayer object
     */
    updatePlayer (player) {
        player.setPlaybackRate(this.ratio);
    }

    /**
     * Update a sound player's playback rate using the current ratio for the
     * effect
     * @param {object} players - a dictionary of SoundPlayer objects to update,
     *     indexed by md5
     */
    updatePlayers (players) {
        if (!players) return;

        for (const id in players) {
            if (players.hasOwnProperty(id)) {
                this.updatePlayer(players[id]);
            }
        }
    }
}

module.exports = PitchEffect;
