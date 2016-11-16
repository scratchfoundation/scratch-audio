/*

ArrayBufferStream wraps the built-in javascript ArrayBuffer, adding the ability to access
data in it like a stream. You can request to read a value from the front of the array,
such as an 8 bit unsigned int, a 16 bit int, etc, and it will keep track of the position
within the byte array, so that successive reads are consecutive.

*/
function ArrayBufferStream (arrayBuffer) {
    this.arrayBuffer = arrayBuffer;
    this.position = 0;
}

// return a new ArrayBufferStream that is a slice of the existing one
ArrayBufferStream.prototype.extract = function (length) {
    var slicedArrayBuffer = this.arrayBuffer.slice(this.position, this.position+length);
    var newStream = new ArrayBufferStream(slicedArrayBuffer);
    return newStream;
};

ArrayBufferStream.prototype.getLength = function () {
    return this.arrayBuffer.byteLength;
};

ArrayBufferStream.prototype.getBytesAvailable = function () {
    return (this.arrayBuffer.byteLength - this.position);
};

ArrayBufferStream.prototype.readUint8 = function () {
    var val = new Uint8Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 1;
    return val;
};

// convert a sequence of bytes of the given length to a string
// for small length strings only
ArrayBufferStream.prototype.readUint8String = function (length) {
    var arr = new Uint8Array(this.arrayBuffer, this.position, length);
    this.position += length;
    var str = '';
    for (var i=0; i<arr.length; i++) {
        str += String.fromCharCode(arr[i]);
    }
    return str;
};

ArrayBufferStream.prototype.readInt16 = function () {
    var val = new Int16Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 2; // one 16 bit int is 2 bytes
    return val;
};

ArrayBufferStream.prototype.readUint16 = function () {
    var val = new Uint16Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 2; // one 16 bit int is 2 bytes
    return val;
};

ArrayBufferStream.prototype.readInt32 = function () {
    var val = new Int32Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 4; // one 32 bit int is 4 bytes
    return val;
};

ArrayBufferStream.prototype.readUint32 = function () {
    var val = new Uint32Array(this.arrayBuffer, this.position, 1)[0];
    this.position += 4; // one 32 bit int is 4 bytes
    return val;
};

module.exports = ArrayBufferStream;
