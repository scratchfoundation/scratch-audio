const ArrayBufferStream = require('./ArrayBufferStream');
const log = require('./log');

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
        return [
            7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
            50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230,
            253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963,
            1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327,
            3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
            12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767
        ];
    }

    /**
     * Data used by the decompression algorithm
     * @type {Array}
     */
    static get INDEX_TABLE () {
        return [
            -1, -1, -1, -1, 2, 4, 6, 8,
            -1, -1, -1, -1, 2, 4, 6, 8
        ];
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

            const samples = this.imaDecompress(this.extractChunk('data', stream), this.adpcmBlockSize);

            const buffer = this.audioContext.createBuffer(1, samples.length, this.samplesPerSecond);

            // @todo optimize this? e.g. replace the divide by storing 1/32768 and multiply?
            for (let i = 0; i < samples.length; i++) {
                buffer.getChannelData(0)[i] = samples[i] / 32768;
            }

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
     * Decompress sample data using the IMA ADPCM algorithm.
     * Note: Handles only one channel, 4-bits per sample.
     * @param  {ArrayBufferStream} compressedData - a stream of compressed audio samples
     * @param  {number} blockSize - the number of bytes in the stream
     * @return {Int16Array} the uncompressed audio samples
     */
    imaDecompress (compressedData, blockSize) {
        let sample;
        let step;
        let code;
        let delta;
        let index = 0;
        let lastByte = -1; // -1 indicates that there is no saved lastByte
        const out = [];

        // Bail and return no samples if we have no data
        if (!compressedData) return out;

        compressedData.position = 0;

        // @todo Update this loop ported from Scratch 2.0 to use a condition or a for loop.
        while (true) { // eslint-disable-line no-constant-condition
            if (((compressedData.position % blockSize) === 0) && (lastByte < 0)) { // read block header
                if (compressedData.getBytesAvailable() === 0) break;
                sample = compressedData.readInt16();
                index = compressedData.readUint8();
                compressedData.position++; // skip extra header byte
                if (index > 88) index = 88;
                out.push(sample);
            } else {
                // read 4-bit code and compute delta from previous sample
                if (lastByte < 0) {
                    if (compressedData.getBytesAvailable() === 0) break;
                    lastByte = compressedData.readUint8();
                    code = lastByte & 0xF;
                } else {
                    code = (lastByte >> 4) & 0xF;
                    lastByte = -1;
                }
                step = ADPCMSoundDecoder.STEP_TABLE[index];
                delta = 0;
                if (code & 4) delta += step;
                if (code & 2) delta += step >> 1;
                if (code & 1) delta += step >> 2;
                delta += step >> 3;
                // compute next index
                index += ADPCMSoundDecoder.INDEX_TABLE[code];
                if (index > 88) index = 88;
                if (index < 0) index = 0;
                // compute and output sample
                sample += (code & 8) ? -delta : delta;
                if (sample > 32767) sample = 32767;
                if (sample < -32768) sample = -32768;
                out.push(sample);
            }
        }
        const samples = Int16Array.from(out);
        return samples;
    }
}

module.exports = ADPCMSoundDecoder;
