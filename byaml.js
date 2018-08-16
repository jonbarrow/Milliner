const struct = require('python-struct');

const NODE_TYPES = {
	STRING: 0xA0,
	ARRAY: 0xC0,
	HASH: 0xC1,
	STRING_TABLE: 0xC2,
	BOOL: 0xD0,
	INT: 0xD1,
	FLOAT: 0xD2,
	UINT: 0xD3,
	INT64: 0xD4,
	UINT64: 0xD5,
	DOUBLE: 0xD6,
	NULL: 0xFF
};

const BE_MAGIC = Buffer.from('BY');
const LE_MAGIC = Buffer.from('YB');

class Byaml {
	constructor(data) {
		this.data = data;
		this.bom = null;

		const header_buffer = this.data.subarray(0x00, 0x14);
		const magic = header_buffer.subarray(0x00, 0x02);

		if (
			!magic.equals(BE_MAGIC) &&
			!magic.equals(LE_MAGIC)
		) {
			throw new Error('File not Byaml archive');
		}

		this.bom = (magic.equals(BE_MAGIC) ? '>' : '<');

		this.version                   = struct.unpack(`${this.bom}H`, header_buffer.subarray(0x02, 0x04))[0];
		this.node_name_table_offset    = struct.unpack(`${this.bom}I`, header_buffer.subarray(0x04, 0x08))[0];
		this.string_value_table_offset = struct.unpack(`${this.bom}I`, header_buffer.subarray(0x08, 0x0C))[0];
		this.path_value_table_offset   = struct.unpack(`${this.bom}I`, header_buffer.subarray(0x0C, 0x10))[0];
		this.root_offset               = struct.unpack(`${this.bom}I`, header_buffer.subarray(0x10, 0x14))[0];
	}

	parse() {
		console.log(this.version);
	}

}

module.exports = Byaml;