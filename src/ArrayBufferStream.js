class ArrayBufferStream {
    /**
     * ArrayBufferStream wraps the built-in javascript ArrayBuffer, adding the ability to access
     * data in it like a stream, tracking its position.
     * You can request to read a value from the front of the array, and it will keep track of the position
     * within the byte array, so that successive reads are consecutive.
     * The available types to read include:
     * Uint8, Uint8String, Int16, Uint16, Int32, Uint32
     * @param {ArrayBuffer} arrayBuffer - array to use as a stream
     * @constructor
     */
    constructor (arrayBuffer) {
        this.arrayBuffer = arrayBuffer;
        this.position = 0;
    }

    /**
     * Return a new ArrayBufferStream that is a slice of the existing one
     * @param  {number} length - the number of bytes of extract
     * @return {ArrayBufferStream} the extracted stream
     */
    extract (length) {
        const slicedArrayBuffer = this.arrayBuffer.slice(this.position, this.position + length);
        const newStream = new ArrayBufferStream(slicedArrayBuffer);
        return newStream;
    }

    /**
     * @return {number} the length of the stream in bytes
     */
    getLength () {
        return this.arrayBuffer.byteLength;
    }

    /**
     * @return {number} the number of bytes available after the current position in the stream
     */
    getBytesAvailable () {
        return (this.arrayBuffer.byteLength - this.position);
    }

    /**
     * Read an unsigned 8 bit integer from the stream
     * @return {number} the next 8 bit integer in the stream
     */
    readUint8 () {
        const val = new Uint8Array(this.arrayBuffer, this.position, 1)[0];
        this.position += 1;
        return val;
    }

    /**
     * Read a sequence of bytes of the given length and convert to a string.
     * This is a convenience method for use with short strings.
     * @param {number} length - the number of bytes to convert
     * @return {string} a String made by concatenating the chars in the input
     */
    readUint8String (length) {
        const arr = new Uint8Array(this.arrayBuffer, this.position, length);
        this.position += length;
        let str = '';
        for (let i = 0; i < arr.length; i++) {
            str += String.fromCharCode(arr[i]);
        }
        return str;
    }

    /**
     * Read a 16 bit integer from the stream
     * @return {number} the next 16 bit integer in the stream
     */
    readInt16 () {
        const val = new Int16Array(this.arrayBuffer, this.position, 1)[0];
        this.position += 2; // one 16 bit int is 2 bytes
        return val;
    }

    /**
     * Read an unsigned 16 bit integer from the stream
     * @return {number} the next unsigned 16 bit integer in the stream
     */
    readUint16 () {
        const val = new Uint16Array(this.arrayBuffer, this.position, 1)[0];
        this.position += 2; // one 16 bit int is 2 bytes
        return val;
    }

    /**
     * Read a 32 bit integer from the stream
     * @return {number} the next 32 bit integer in the stream
     */
    readInt32 () {
        const val = new Int32Array(this.arrayBuffer, this.position, 1)[0];
        this.position += 4; // one 32 bit int is 4 bytes
        return val;
    }

    /**
     * Read an unsigned 32 bit integer from the stream
     * @return {number} the next unsigned 32 bit integer in the stream
     */
    readUint32 () {
        const val = new Uint32Array(this.arrayBuffer, this.position, 1)[0];
        this.position += 4; // one 32 bit int is 4 bytes
        return val;
    }
}

module.exports = ArrayBufferStream;
