const struct = require('python-struct');

const MAGIC = 'FSKL';

class FSKL {
	constructor(stream) {
		const magic = stream.String(4);
		if (magic != MAGIC) {
			throw new Error('Faild to find FSKL magic');
		}
		
		stream.skip(12); // padding

		if (stream.version_num_b == 8) {
			this.bone_index_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
			this.bone_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
			this.inv_index_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
			this.inv_matr_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
			stream.skip(8); // padding
			this.fskl_type = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
			this.bone_array_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
			this.inv_index_array_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
			this.ex_index_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
			stream.skip(4); // unknown
		} else {
			this.bone_index_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
			this.bone_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
			this.inv_index_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
			this.inv_matr_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
			stream.skip(8); // padding
			stream.skip(8); // padding
			stream.skip(8); // padding
			this.fskl_type = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
			this.bone_array_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
			this.inv_index_array_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
			this.ex_index_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
			stream.skip(4); // unknown
		}
	}
}

module.exports = FSKL;