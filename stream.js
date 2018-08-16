class Stream {
	constructor(buffer) {
		this.pos = 0;
		this.buffer = buffer;
	}

	read(len) {
		const read = this.buffer.subarray(this.pos, this.pos + len);
		this.pos += len;

		return read;
	}

	bytes(len) {
		return this.read(len);
	}

	byte() {
		return this.read(1);
	}

	Int8() {
		return this.byte().readInt8();
	}

	UInt8() {
		return this.byte().readUInt8();
	}

	Int16LE() {
		return this.read(2).readInt16LE();
	}

	UInt16LE() {
		return this.read(2).readUInt16LE();
	}

	Int16BE() {
		return this.read(2).readInt16BE();
	}

	UInt16BE() {
		return this.read(2).readUInt16BE();
	}

	Int32LE() {
		return this.read(4).readInt32LE();
	}

	UInt32LE() {
		return this.read(4).readUInt32LE();
	}

	Int32BE() {
		return this.read(4).readInt32BE();
	}

	UInt32BE() {
		return this.read(4).readUInt32BE();
	}

	string(len=1, encoding='utf8') {
		return this.bytes(len).toString(encoding);
	}
}

module.exports = Stream;