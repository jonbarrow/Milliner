/*
	http://mk8.tockdom.com/wiki/BFRES_(File_Format) seems to either be very wrong about some stuff,
	or is not written to handle more modern versions of BFRES.

	Because of this, I will not really be following those docs very much, which may mean this script
	won't work with other versions of BFRES, or with BFRES files from other games.

	This project is aimed at specifically Super Mario Odyssey. This should not be used as a generic
	BFRES handler for Node/JavaScript since I cannot promise stability with files from other
	games.

	This is made up of a mix of ports from various Python/C# scripts around the internet as well as my own REing, so I apologize if some things are wrong
*/

const struct = require('python-struct');
const bmp = require('bmp-js');
const Stream = require('./stream');
const FMDL = require('./fmdl');
const BTNX = require('./btnx');
//const FSKA = require('./fska');
//const EMBO = require('./embo');

const MAGIC = 'FRES';
const BYTE_ORDER = {
	BIG: 0xFEFF,
	LITTLE: 0xFFFE
};

const SWITCH_VER_FLAG = 0x20202020;

const TEXTURE_FORMAT_TYPES = {
	R5G6B5:    0x07,
	R8G8:      0x09,
	R16:       0x0a,
	R8G8B8A8:  0x0b,
	R11G11B10: 0x0f,
	R32:       0x14,
	BC1:       0x1a,
	BC2:       0x1b,
	BC3:       0x1c,
	BC4:       0x1d,
	BC5:       0x1e,
	ASTC4x4:   0x2d,
	ASTC5x4:   0x2e,
	ASTC5x5:   0x2f,
	ASTC6x5:   0x30,
	ASTC6x6:   0x31,
	ASTC8x5:   0x32,
	ASTC8x6:   0x33,
	ASTC8x8:   0x34,
	ASTC10x5:  0x35,
	ASTC10x6:  0x36,
	ASTC10x8:  0x37,
	ASTC10x10: 0x38,
	ASTC12x10: 0x39,
	ASTC12x12: 0x3a
};

class BFRES extends Stream {
	constructor(data) {
		super(data);

		this.version = 0;
		this.bom = null;

		this.textures = {};

		this.fmdls = [];
		this.fskas = [];
		this.fmaas = [];
		this.fviss = [];
		this.fshus = [];
		this.fscns = [];
		this.embos = [];

		this.parse();
	}

	parse() {
		const magic = this.String(4);
		if (magic != MAGIC) {
			throw new Error('File not BFRES file');
		}

		if (this.UInt32BE() !== SWITCH_VER_FLAG) {
			throw new Error('Not valid Nintendo Switch BFRES model');
		}

		this.version_num_d = this.UInt8();
		this.version_num_c = this.UInt8();
		this.version_num_b = this.UInt8();
		this.version_num_a = this.UInt8();

		this.version = [
			this.version_num_a,
			this.version_num_b,
			this.version_num_c,
			this.version_num_d
		].join('.');

		if (this.UInt16BE() == BYTE_ORDER.BIG) {
			this.bom = '>';
		} else {
			this.bom = '<';
		}

		this.skip(2); // header size
		this.name_offset = struct.unpack(`${this.bom}I`, this.bytes(4))[0];
		this.name = this.parse_string(this.name_offset);
		this.file_alignment = struct.unpack(`${this.bom}I`, this.bytes(4))[0];
		this.relocation_table_offset = struct.unpack(`${this.bom}I`, this.bytes(4))[0];
		this.size = struct.unpack(`${this.bom}I`, this.bytes(4))[0];
		if (this.size !== this.data.length) {
			throw new Error('Error parsing BFRES header data. Size does not match buffer length');
		}

		const real_pos = this.pos;

		this.relocation_table = new RelocationTable(this);

		this.pos = real_pos;

		this.skip(4); // another way of getting the name offset. This int + 2 = name offset
		this.skip(4); // padding

		this.fmdl_offset = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fmdl_dict = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fska_offset = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fska_dict = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fmaa_offset = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fmaa_dict = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fvis_offset = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fvis_dict = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fshu_offset = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fshu_dict = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fscn_offset = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.fscn_dict = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.buffer_memory_pool_offset = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.buffer_memory_pool_info = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.embo_offset = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.embo_dict = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();

		this.skip(8); // padding
		this.string_table_offset = struct.unpack(`${this.bom}Q`, this.bytes(8))[0].toNumber();
		this.string_table_size = struct.unpack(`${this.bom}I`, this.bytes(4))[0]; // maybe? Seems to be right but seems to be off by a few bytes

		this.fmdl_count = struct.unpack(`${this.bom}H`, this.bytes(2))[0];
		this.fska_count = struct.unpack(`${this.bom}H`, this.bytes(2))[0];
		this.fmaa_count = struct.unpack(`${this.bom}H`, this.bytes(2))[0];
		this.fvis_count = struct.unpack(`${this.bom}H`, this.bytes(2))[0];
		this.fshu_count = struct.unpack(`${this.bom}H`, this.bytes(2))[0];
		this.fscn_count = struct.unpack(`${this.bom}H`, this.bytes(2))[0];
		this.embo_count = struct.unpack(`${this.bom}H`, this.bytes(2))[0];

		this.skip(12); // padding

		for (let i = 0; i < this.embo_count; i++) {
			this.seek(this.embo_offset + (i * 16));
			const data_offset = struct.unpack(`${this.bom}I`, this.bytes(4))[0];
			this.seek(data_offset);
			if (this.String(4) == 'BNTX') {
				this.seek(data_offset);
				
				const texture = new BTNX(this);
				this.textures[texture.name] = texture;
			}
		}

		this.seek(this.fmdl_offset);
		for (let i = 0; i < this.fmdl_count; i++) {
			this.seek(this.fmdl_offset + (i * 120));
			this.fmdls.push(new FMDL(this));
		}
	}

	export(fmdl) {
		const obj_stream = new WritableStream();
		const mtl_stream = new WritableStream();
		const mats_to_export = [];

		obj_stream.writeLine(`mtllib ${this.name}.mtl`);
		let vertex_offest = 1;
		let use_empty_mat = false;

		for (const mesh of fmdl.polygons) {
			let no_texture = mesh.vertices[0].tx.length == 0;
			for (const v of mesh.vertices) {
				obj_stream.writeLine(`v ${v.pos.x.toString()} ${v.pos.y.toString()} ${v.pos.z.toString()}`);
				if (!no_texture) {
					obj_stream.writeLine(`vt ${v.tx[0].x.toString()} ${(1 - v.tx[0].y).toString()}`);
				} else {
					obj_stream.writeLine('vt 0 0');
				}
				obj_stream.writeLine(`vn ${v.nrm.x.toString()} ${v.nrm.y.toString()} ${v.nrm.z.toString()}`);
			}

			if (mesh.texture_names.length == 0) {
				use_empty_mat = true;
				no_texture = true;
				obj_stream.writeLine('usemtl Milliner_EmptyMat');
			} else {
				for (const texture_name of mesh.texture_names) {
					if (!mats_to_export.includes(texture_name)) {
						mats_to_export.push(texture_name);
					}
					obj_stream.writeLine(`usemtl ${mesh.texture_names[0]}`);
				}
			}

			for (let i = 0; i < mesh.faces.length; i++) {
				const verts = mesh.faces[i];
				const vert_1 = verts[0] + vertex_offest;
				const vert_2 = verts[1] + vertex_offest;
				const vert_3 = verts[2] + vertex_offest;

				if (!no_texture) {
					obj_stream.writeLine(`f ${vert_1.toString()}/${vert_1.toString()}/${vert_1.toString()} ${vert_2.toString()}/${vert_2.toString()}/${vert_2.toString()} ${vert_3.toString()}/${vert_3.toString()}/${vert_3.toString()}`);
				} else {
					obj_stream.writeLine(`f ${vert_1.toString()}//${vert_1.toString()} ${vert_2.toString()}//${vert_2.toString()} ${vert_3.toString()}//${vert_3.toString()}`);
				}
			}

			vertex_offest += mesh.vertices.length;
		}

		if (use_empty_mat) {
			mtl_stream.writeLine('newmtl Milliner_EmptyMat');
			mtl_stream.writeLine('Ka 0.000000 0.000000 0.000000');
			mtl_stream.writeLine('Kd 0.800000 0.800000 0.800000');
			mtl_stream.writeLine('Ks 0.0 0.0 0.0 \n');
		}

		for (const material of mats_to_export) {
			mtl_stream.writeLine(`newmtl ${material}`);
			mtl_stream.writeLine('Ka 0.000000 0.000000 0.000000');
			mtl_stream.writeLine('Kd 1.000000 1.000000 1.000000');
			mtl_stream.writeLine('Ks 0.0 0.0 0.0');
			mtl_stream.writeLine(`map_Kd textures/${material}.bmp \n`);
		}

		const exported_textures = [];

		for (const key of Object.keys(this.textures)) {
			for (const texture of this.textures[key].textures) {
				exported_textures.push({
					name: texture.name,
					path: `textures/${texture.name}.bmp`,
					//data: export_texture(texture)
				});
			}
		}

		return {
			obj: obj_stream.buffer,
			mtl: mtl_stream.buffer,
			textures: exported_textures
		};
	}

	/* Helper methods */

	parse_string(offset) {
		const string_end = this.data.subarray(offset).indexOf('\0');
		return String(this.data.subarray(offset, offset + string_end).toString());
	}
}

class RelocationTable {
	constructor(stream) {
		stream.seek(stream.relocation_table_offset);
		stream.skip(0x030);
		this.data_start = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
	}
}

class WritableStream {
	constructor() {
		this.buffer = Buffer.from('');
	}

	write(chunk) {
		chunk = Buffer.from(chunk.toString());
		this.buffer = Buffer.concat([this.buffer, chunk]);
	}

	writeLine(chunk) {
		this.write(chunk + '\n');
	}
}

function export_texture(texture, offset = 0) {

	const img = decode_texture(texture, offset);

	return img;
}

function decode_texture(texture, offset) {
	const bmp_data = {
		width: texture.width,
		height: texture.height
	};
	const swizzle = texture.getSwizzle();

	switch (texture.format_type) {
		case TEXTURE_FORMAT_TYPES.BC1:
			const w = (texture.width  + 3) / 4;
			const h = (texture.height + 3) / 4;
			const buffer = Buffer.alloc(w * h * 64);

			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++) {
					const i_offset = offset + swizzle.getSwizzleOffset(x, y);
					
				}
			}

			bmp_data.width *= 4;
			bmp_data.height *= 4;
			bmp_data.data = buffer;
			break;
		case TEXTURE_FORMAT_TYPES.BC4:
			bmp_data.data = 'buffer';
			break;
		case TEXTURE_FORMAT_TYPES.BC5:
			bmp_data.data = 'buffer';
			break;

		default:
			break;
	}

	return bmp.encode(bmp_data);
}

module.exports = BFRES;