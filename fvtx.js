const struct = require('python-struct');

const MAGIC = 'FVTX';

class FVTX {
	constructor(stream) {
		const magic = stream.String(4);
		if (magic != MAGIC) {
			throw new Error('Faild to find FVTX magic');
		}
		stream.skip(12); // padding

		this.attribute_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.attribute_index_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		stream.skip(8); // unknown
		stream.skip(8); // unknown
		stream.skip(8); // unknown
		this.buffer_size_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.buffer_stride_size_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.buffer_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.buffer_offset = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
		this.attribute_count = stream.UInt8();
		this.buffer_count = stream.UInt8();
		this.section_index = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.vertex_count = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
		this.skin_weight = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
	}
}

module.exports = FVTX;