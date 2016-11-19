/*

ADPCMSoundLoader loads wav files that have been compressed with the ADPCM format

based on code from Scratch-Flash:
https://github.com/LLK/scratch-flash/blob/master/src/sound/WAVFile.as

to do: I think this will ultimately need to run in a web worker

*/

var ArrayBufferStream = require('./ArrayBufferStream');
var Tone = require('tone');
var log = require('./log');

function ADPCMSoundLoader () {
}

ADPCMSoundLoader.prototype.load = function (url) {

    return new Promise(function (resolve, reject) {

        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';

        request.onload = function () {
            var audioData = request.response;
            var stream = new ArrayBufferStream(audioData);

            var riffStr = stream.readUint8String(4);
            if (riffStr != 'RIFF') {
                log.warn('incorrect adpcm wav header');
                reject();
            }

            var lengthInHeader = stream.readInt32();
            if ((lengthInHeader + 8) != audioData.byteLength) {
                log.warn('adpcm wav length in header: ' + lengthInHeader + ' is incorrect');
            }

            var wavStr = stream.readUint8String(4);
            if (wavStr != 'WAVE') {
                log.warn('incorrect adpcm wav header');
                reject();
            }

            var formatChunk = this.extractChunk('fmt ', stream);
            this.encoding = formatChunk.readUint16();
            this.channels = formatChunk.readUint16();
            this.samplesPerSecond = formatChunk.readUint32();
            this.bytesPerSecond = formatChunk.readUint32();
            this.blockAlignment = formatChunk.readUint16();
            this.bitsPerSample = formatChunk.readUint16();
            formatChunk.position += 2;  // skip extra header byte count
            this.samplesPerBlock = formatChunk.readUint16();
            this.adpcmBlockSize = ((this.samplesPerBlock - 1) / 2) + 4; // block size in bytes

            var samples = this.imaDecompress(this.extractChunk('data', stream), this.adpcmBlockSize);

            // this line is the only place Tone is used here, should be possible to remove
            var buffer = Tone.context.createBuffer(1, samples.length, this.samplesPerSecond);

            // todo: optimize this? e.g. replace the divide by storing 1/32768 and multiply?
            for (var i=0; i<samples.length; i++) {
                buffer.getChannelData(0)[i] = samples[i] / 32768;
            }

            resolve(buffer);

        }.bind(this);

        request.send();

    }.bind(this));
};


ADPCMSoundLoader.prototype.stepTable = [
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
    50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230,
    253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963,
    1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327,
    3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
    12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];

ADPCMSoundLoader.prototype.indexTable = [
    -1, -1, -1, -1, 2, 4, 6, 8,
    -1, -1, -1, -1, 2, 4, 6, 8];

ADPCMSoundLoader.prototype.extractChunk = function (chunkType, stream) {
    stream.position = 12;
    while (stream.position < (stream.getLength() - 8)) {
        var typeStr = stream.readUint8String(4);
        var chunkSize = stream.readInt32();
        if (typeStr == chunkType) {
            var chunk = stream.extract(chunkSize);
            return chunk;
        } else {
            stream.position += chunkSize;
        }
    }
};

ADPCMSoundLoader.prototype.imaDecompress = function (compressedData, blockSize) {
    // Decompress sample data using the IMA ADPCM algorithm.
    // Note: Handles only one channel, 4-bits/sample.
    var sample, step, code, delta;
    var index = 0;
    var lastByte = -1; // -1 indicates that there is no saved lastByte
    var out = [];

    // Bail and return no samples if we have no data
    if (!compressedData) return out;

    compressedData.position = 0;
    var a = 0;
    while (a==0) {
        if (((compressedData.position % blockSize) == 0) && (lastByte < 0)) { // read block header
            if (compressedData.getBytesAvailable() == 0) break;
            sample = compressedData.readInt16();
            index = compressedData.readUint8();
            compressedData.position++; // skip extra header byte
            if (index > 88) index = 88;
            out.push(sample);
        } else {
            // read 4-bit code and compute delta from previous sample
            if (lastByte < 0) {
                if (compressedData.getBytesAvailable() == 0) break;
                lastByte = compressedData.readUint8();
                code = lastByte & 0xF;
            } else {
                code = (lastByte >> 4) & 0xF;
                lastByte = -1;
            }
            step = this.stepTable[index];
            delta = 0;
            if (code & 4) delta += step;
            if (code & 2) delta += step >> 1;
            if (code & 1) delta += step >> 2;
            delta += step >> 3;
            // compute next index
            index += this.indexTable[code];
            if (index > 88) index = 88;
            if (index < 0) index = 0;
            // compute and output sample
            sample += (code & 8) ? -delta : delta;
            if (sample > 32767) sample = 32767;
            if (sample < -32768) sample = -32768;
            out.push(sample);
        }
    }
    var samples = Int16Array.from(out);
    return samples;
};

module.exports = ADPCMSoundLoader;
