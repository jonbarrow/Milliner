const struct = require('python-struct');

const MAGIC = 'FMAT';

class FMAT {
	constructor(stream) {
		const magic = stream.String(4);
		if (magic != MAGIC) {
			throw new Error('Faild to find FMAT magic');
		}
		
		stream.skip(12); // padding

		this.name = stream.parse_string(struct.unpack(`${stream.bom}I`, stream.bytes(4))[0] + 2);
		stream.skip(4);
		this.render_info_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.render_info_index = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.shader_assign_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		stream.skip(8); // unknown
		this.texture_sel_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		stream.skip(8); // unknown
		this.texture_attribute_sel_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.texture_attribute_index_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.material_param_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.material_param_index_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.material_param_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.user_data_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.user_data_index_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.volatile_flag_offsetset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		stream.skip(8); // unknown
		this.sampler_slot_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.texture_slot_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.flags = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0]; //This toggles material visabilty
		this.section_index = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.render_param_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.texture_sel_count = stream.UInt8();
		this.texture_attribute_sel_count = stream.UInt8();
		this.material_param_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		stream.skip(2); // unknown
		this.material_param_size = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.raw_param_data_size = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.user_data_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		stream.skip(4); // padding
	}
}

module.exports = FMAT;