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
function ArrayBufferStream (arrayBuffer) {
    this.arrayBuffer = arrayBuffer;
    this.position = 0;
}

/**
 * Return a new ArrayBufferStream that is a slice of the existing one
 * @param  {number} length - the number of bytes of extract
 * @return {ArrayBufferStream} the extracted stream
 */
ArrayBufferStream.prototype.extract = function (length) {
    var slicedArrayBuffer = this.arrayBuffer.slice(this.position, this.position+length);
    var newStream = new ArrayBufferStream(slicedArrayBuffer);
    return newStream;
};

/**
 * @return {number} the length of the stream in bytes
 */
ArrayBufferStream.prototype.getLength = function () {
    return this.arrayBuffer.byteLength;
};

/**
 * @return {number} the number of bytes available after the current position in the stream
 */
ArrayBufferStream.prototype.getBytesAvailable = function () {
    return (this.arrayBuffer.byteLength - this.position);
};

/**
 * Read an unsigned 8 bit integer from the stream
 * @return {number}
 */
ArrayBufferStream.prototype.readUint8 = function () {
    var val = new Uint8Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 1;
    return val;
};

/**
 * Read a sequence of bytes of the given length and convert to a string.
 * This is a convenience method for use with short strings.
 * @param {number} length - the number of bytes to convert
 * @return {String} a String made by concatenating the chars in the input
 */
ArrayBufferStream.prototype.readUint8String = function (length) {
    var arr = new Uint8Array(this.arrayBuffer, this.position, length);
    this.position += length;
    var str = '';
    for (var i=0; i<arr.length; i++) {
        str += String.fromCharCode(arr[i]);
    }
    return str;
};

/**
 * Read a 16 bit integer from the stream
 * @return {number}
 */
ArrayBufferStream.prototype.readInt16 = function () {
    var val = new Int16Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 2; // one 16 bit int is 2 bytes
    return val;
};

/**
 * Read an unsigned 16 bit integer from the stream
 * @return {number}
 */
ArrayBufferStream.prototype.readUint16 = function () {
    var val = new Uint16Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 2; // one 16 bit int is 2 bytes
    return val;
};

/**
 * Read a 32 bit integer from the stream
 * @return {number}
 */
ArrayBufferStream.prototype.readInt32 = function () {
    var val = new Int32Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 4; // one 32 bit int is 4 bytes
    return val;
};

/**
 * Read an unsigned 32 bit integer from the stream
 * @return {number}
 */
ArrayBufferStream.prototype.readUint32 = function () {
    var val = new Uint32Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 4; // one 32 bit int is 4 bytes
    return val;
};

module.exports = ArrayBufferStream;
