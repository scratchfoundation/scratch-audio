const ArrayBufferStream = require('./ArrayBufferStream');
const log = require('./log');

/**
 * Data used by the decompression algorithm
 * @type {Array}
 */
const STEP_TABLE = [
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
    50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230,
    253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963,
    1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327,
    3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
    12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767
];

/**
 * Data used by the decompression algorithm
 * @type {Array}
 */
const INDEX_TABLE = [
    -1, -1, -1, -1, 2, 4, 6, 8,
    -1, -1, -1, -1, 2, 4, 6, 8
];

let _deltaTable = null;

/**
 * Build a table of deltas from the 89 possible steps and 16 codes.
 * @return {Array<number>} computed delta values
 */
const deltaTable = function () {
    if (_deltaTable === null) {
        const NUM_STEPS = STEP_TABLE.length;
        const NUM_INDICES = INDEX_TABLE.length;
        _deltaTable = new Array(NUM_STEPS * NUM_INDICES).fill(0);
        let i = 0;

        for (let index = 0; index < NUM_STEPS; index++) {
            for (let code = 0; code < NUM_INDICES; code++) {
                const step = STEP_TABLE[index];

                let delta = 0;
                if (code & 4) delta += step;
                if (code & 2) delta += step >> 1;
                if (code & 1) delta += step >> 2;
                delta += step >> 3;
                _deltaTable[i++] = (code & 8) ? -delta : delta;
            }
        }
    }

    return _deltaTable;
};

/**
 * Decode wav audio files that have been compressed with the ADPCM format.
 * This is necessary because, while web browsers have native decoders for many audio
 * formats, ADPCM is a non-standard format used by Scratch since its early days.
 * This decoder is based on code from Scratch-Flash:
 * https://github.com/LLK/scratch-flash/blob/master/src/sound/WAVFile.as
 */
class ADPCMSoundDecoder {
    /**
     * @param {AudioContext} audioContext - a webAudio context
     * @constructor
     */
    constructor (audioContext) {
        this.audioContext = audioContext;
    }

    /**
     * Data used by the decompression algorithm
     * @type {Array}
     */
    static get STEP_TABLE () {
        return STEP_TABLE;
    }

    /**
     * Data used by the decompression algorithm
     * @type {Array}
     */
    static get INDEX_TABLE () {
        return INDEX_TABLE;
    }

    /**
     * Decode an ADPCM sound stored in an ArrayBuffer and return a promise
     * with the decoded audio buffer.
     * @param  {ArrayBuffer} audioData - containing ADPCM encoded wav audio
     * @return {AudioBuffer} the decoded audio buffer
     */
    decode (audioData) {

        return new Promise((resolve, reject) => {
            const stream = new ArrayBufferStream(audioData);

            const riffStr = stream.readUint8String(4);
            if (riffStr !== 'RIFF') {
                log.warn('incorrect adpcm wav header');
                reject();
            }

            const lengthInHeader = stream.readInt32();
            if ((lengthInHeader + 8) !== audioData.byteLength) {
                log.warn(`adpcm wav length in header: ${lengthInHeader} is incorrect`);
            }

            const wavStr = stream.readUint8String(4);
            if (wavStr !== 'WAVE') {
                log.warn('incorrect adpcm wav header');
                reject();
            }

            const formatChunk = this.extractChunk('fmt ', stream);
            this.encoding = formatChunk.readUint16();
            this.channels = formatChunk.readUint16();
            this.samplesPerSecond = formatChunk.readUint32();
            this.bytesPerSecond = formatChunk.readUint32();
            this.blockAlignment = formatChunk.readUint16();
            this.bitsPerSample = formatChunk.readUint16();
            formatChunk.position += 2;  // skip extra header byte count
            this.samplesPerBlock = formatChunk.readUint16();
            this.adpcmBlockSize = ((this.samplesPerBlock - 1) / 2) + 4; // block size in bytes

            const compressedData = this.extractChunk('data', stream);
            const sampleCount = this.numberOfSamples(compressedData, this.adpcmBlockSize);

            const buffer = this.audioContext.createBuffer(1, sampleCount, this.samplesPerSecond);
            this.imaDecompress(compressedData, this.adpcmBlockSize, buffer.getChannelData(0));

            resolve(buffer);
        });
    }

    /**
     * Extract a chunk of audio data from the stream, consisting of a set of audio data bytes
     * @param  {string} chunkType - the type of chunk to extract. 'data' or 'fmt' (format)
     * @param  {ArrayBufferStream} stream - an stream containing the audio data
     * @return {ArrayBufferStream} a stream containing the desired chunk
     */
    extractChunk (chunkType, stream) {
        stream.position = 12;
        while (stream.position < (stream.getLength() - 8)) {
            const typeStr = stream.readUint8String(4);
            const chunkSize = stream.readInt32();
            if (typeStr === chunkType) {
                const chunk = stream.extract(chunkSize);
                return chunk;
            }
            stream.position += chunkSize;

        }
    }

    /**
     * Count the exact number of samples in the compressed data.
     * @param {ArrayBufferStream} compressedData - the compressed data
     * @param {number} blockSize - size of each block in the data in bytes
     * @return {number} number of samples in the compressed data
     */
    numberOfSamples (compressedData, blockSize) {
        if (!compressedData) return 0;

        compressedData.position = 0;

        const available = compressedData.getBytesAvailable();
        const blocks = (available / blockSize) | 0;
        // Number of samples in full blocks.
        const fullBlocks = blocks * (2 * (blockSize - 4)) + 1;
        // Number of samples in the last incomplete block. 0 if the last block
        // is full.
        const subBlock = Math.max((available % blockSize) - 4, 0) * 2;
        // 1 if the last block is incomplete. 0 if it is complete.
        const incompleteBlock = Math.min(available % blockSize, 1);
        return fullBlocks + subBlock + incompleteBlock;
    }

    /**
     * Decompress sample data using the IMA ADPCM algorithm.
     * Note: Handles only one channel, 4-bits per sample.
     * @param  {ArrayBufferStream} compressedData - a stream of compressed audio samples
     * @param  {number} blockSize - the number of bytes in the stream
     * @param  {Float32Array} out - the uncompressed audio samples
     */
    imaDecompress (compressedData, blockSize, out) {
        let sample;
        let code;
        let delta;
        let index = 0;
        let lastByte = -1; // -1 indicates that there is no saved lastByte

        // Bail and return no samples if we have no data
        if (!compressedData) return;

        compressedData.position = 0;

        const size = out.length;
        const samplesAfterBlockHeader = (blockSize - 4) * 2;

        const DELTA_TABLE = deltaTable();

        let i = 0;
        while (i < size) {
            // read block header
            sample = compressedData.readInt16();
            index = compressedData.readUint8();
            compressedData.position++; // skip extra header byte
            if (index > 88) index = 88;
            out[i++] = sample / 32768;

            const blockLength = Math.min(samplesAfterBlockHeader, size - i);
            const blockStart = i;
            while (i - blockStart < blockLength) {
                // read 4-bit code and compute delta from previous sample
                lastByte = compressedData.readUint8();
                code = lastByte & 0xF;
                delta = DELTA_TABLE[index * 16 + code];
                // compute next index
                index += INDEX_TABLE[code];
                if (index > 88) index = 88;
                else if (index < 0) index = 0;
                // compute and output sample
                sample += delta;
                if (sample > 32767) sample = 32767;
                else if (sample < -32768) sample = -32768;
                out[i++] = sample / 32768;

                // use 4-bit code from lastByte and compute delta from previous
                // sample
                code = (lastByte >> 4) & 0xF;
                delta = DELTA_TABLE[index * 16 + code];
                // compute next index
                index += INDEX_TABLE[code];
                if (index > 88) index = 88;
                else if (index < 0) index = 0;
                // compute and output sample
                sample += delta;
                if (sample > 32767) sample = 32767;
                else if (sample < -32768) sample = -32768;
                out[i++] = sample / 32768;
            }
        }
    }
}

module.exports = ADPCMSoundDecoder;
