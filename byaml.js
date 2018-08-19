/*
	http://mk8.tockdom.com/wiki/BYAML_(File_Format) seems to either be very wrong about some stuff,
	or is not written to handle more modern versions of byml/byaml.

	Because of this, I will not really be following those docs very much, which may mean this script
	won't work with other versions of byml/byaml, or with byml/byaml files from other games.

	This project is aimed at specifically Super Mario Odyssey. This should not be used as a generic
	byml/byaml handler for Node/JavaScript since I cannot promise stability with files from other
	games.

*/

const struct = require('python-struct');
const byteData = require('byte-data');

const NODE_TYPES = {
	STRING: 0xA0,
	PATH: 0xA1,
	ARRAY: 0xC0,
	DICTIONARY: 0xC1,
	STRING_TABLE: 0xC2,
	//PATH_TABLE: 0xC3, // seems to not be used in v3/Switch byml files?
	BOOL: 0xD0,
	INT: 0xD1,
	FLOAT: 0xD2,
	// These don't seem to exist in v1?
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
		this.root = this.parse();
	}

	parse() {
		const header_buffer = this.data.subarray(0x00, 0x14);
		const magic = header_buffer.subarray(0x00, 0x02);

		if (
			!magic.equals(BE_MAGIC) &&
			!magic.equals(LE_MAGIC)
		) {
			throw new Error('File not Byaml archive');
		}

		this.bom = (magic.equals(BE_MAGIC) ? '>' : '<');
		this.be = (magic.equals(BE_MAGIC) ? true : false);

		this.version = struct.unpack(`${this.bom}H`, header_buffer.subarray(0x02, 0x04))[0];
		this.node_name_table_offset = struct.unpack(`${this.bom}I`, header_buffer.subarray(0x04, 0x08))[0];
		this.string_value_table_offset = struct.unpack(`${this.bom}I`, header_buffer.subarray(0x08, 0x0C))[0];
		this.root_offset = struct.unpack(`${this.bom}I`, header_buffer.subarray(0x0C, 0x10))[0];

		if (!this.root_offset) {
			return {};
		}

		if (this.node_name_table_offset) {
			this.node_name_table = this.parse_string_table(this.node_name_table_offset);
		}

		if (this.string_value_table_offset) {
			this.string_value_table = this.parse_string_table(this.string_value_table_offset);
		}

		const root_type = this.data[this.root_offset];

		if (
			root_type !== NODE_TYPES.ARRAY &&
			root_type !== NODE_TYPES.DICTIONARY
		) {
			throw new Error(`Invalid root type. Expected either ${NODE_TYPES.ARRAY} or ${NODE_TYPES.DICTIONARY}. Got ${root_type}`);
		}

		return this.parse_node(root_type, this.root_offset);
	}

	parse_node(type, offset) {
		//console.log(type.toString(16));
		switch (type) {
			case NODE_TYPES.STRING:
				return this.parse_string(offset);
			case NODE_TYPES.PATH:
				return this.parse_path(offset);
			case NODE_TYPES.ARRAY:
				return this.parse_array(offset);
			case NODE_TYPES.DICTIONARY:
				return this.parse_dictionary(offset);
			case NODE_TYPES.STRING_TABLE:
				return this.parse_string_table(offset);
			case NODE_TYPES.BOOL:
				return this.parse_bool(offset);
			case NODE_TYPES.INT:
				return this.parse_int(offset);
			case NODE_TYPES.FLOAT:
				return this.parse_float(offset);
			case NODE_TYPES.UINT:
				return this.parse_uint(offset);
			case NODE_TYPES.INT64:
				return this.parse_int64(offset);
			case NODE_TYPES.UINT64:
				return this.parse_uint64(offset);
			case NODE_TYPES.DOUBLE:
				return this.parse_double(offset);
			default:
				throw new Error(`Unknown node type ${type}`);
		}
	}

	parse_string(offset) {
		const string_end = this.data.subarray(offset).indexOf('\0');
		return this.data.subarray(offset, offset + string_end).toString();
	}

	parse_path(offset) {}

	parse_array(offset) {
		const array = [];
		const array_size = byteData.unpack(this.data.subarray(offset + 1), {
			bits: 24,
			signed: false,
			be: this.be
		}, 0);

		const value_array_offset = offset + align_up(array_size, 4) + 4;

		for (let i = 0; i < array_size; i++) {
			const node_type = this.data[offset + 4 + i];
			array.push(this.parse_node(node_type, value_array_offset + (4 * i)));
		}

		return array;
	}

	parse_dictionary(offset) {
		const dictionary = {};
		const dictionary_size = byteData.unpack(this.data.subarray(offset + 1), {
			bits: 24,
			signed: false,
			be: this.be
		}, 0);

		const dictionary_data = this.data.subarray(offset + 3, offset + 3 + (dictionary_size * 8));

		for (let i = 0; i < dictionary_size; i++) {
			const dictionary_data_offset = 8 * i;
			const dictionary_entry = dictionary_data.subarray(dictionary_data_offset, dictionary_data_offset + 8);
			const name_index = byteData.unpack(dictionary_entry.subarray(0, 3), {
				bits: 24,
				signed: false,
				be: this.be
			}, 0);

			console.log(name_index); // kill me
		}

		return dictionary;
	}


	parse_string_table(offset) {
		if (this.data[offset] !== NODE_TYPES.STRING_TABLE) {
			throw new Error(`Could not find string table at offset ${offset}. Found ${(this.data[offset]).toString(16)}`);
		}

		const table = [];
		const table_size = byteData.unpack(this.data.subarray(offset + 1), {
			bits: 24,
			signed: false,
			be: this.be
		}, 0);

		for (let i = 0; i < table_size; i++) {
			const string_offset = offset + struct.unpack(`${this.bom}I`, this.data.subarray(offset + 4 + (4 * i)))[0];
			table.push(this.parse_string(string_offset));
		}

		return table;
	}

	parse_bool(offset) {}

	parse_int(offset) {}

	parse_float(offset) {}

	parse_uint(offset) {}

	parse_int64(offset) {}

	parse_uint64(offset) {}

	parse_double(offset) {}
}

module.exports = Byaml;

function align_up(value, size) {
	return value + (size - value % size) % size;
}