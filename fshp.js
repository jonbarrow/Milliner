const struct = require('python-struct');

const MAGIC = 'FSHP';

class FSHP {
	constructor(stream) {
		const magic = stream.String(4);
		if (magic != MAGIC) {
			throw new Error('Faild to find FSHP magic');
		}
		
		stream.skip(12); // padding

		this.poly_name_offset = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
		stream.skip(4); // unknown
		this.fvtx_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.lod_model_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.fskl_index_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		stream.skip(8); // unknown
		stream.skip(8); // unknown
		this.bounding_box_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.radius_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		stream.skip(8); // unknown
		this.flags = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
		this.section_index = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.fmat_index = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.fskl_index = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.fvtx_index = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.fskl_index_array_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.material_flag = stream.UInt8();
		this.lod_model_count = stream.UInt8();
		this.visibility_group_count = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
		this.visibility_group_index_offset = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.visibility_group_node_offset = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
	}
}

module.exports = FSHP;