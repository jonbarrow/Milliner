const struct = require('python-struct');
const Vec2 = require('vec2');
const Vec3 = require('vec3').Vec3;
const Vec4 = require('@nathanfaucett/vec4');
const FVTX = require('./fvtx');
const FMAT = require('./fmat');
const FSKL = require('./fskl');
const FSHP = require('./fshp');

const MAGIC = 'FMDL';

class FMDL {
	constructor(stream) {

		this.fvtxs = [];
		this.fmats = [];
		this.fshps = [];
		this.nodes = [];
		this.polygons = [];

		const magic = stream.String(4);
		if (magic != MAGIC) {
			throw new Error('Faild to find FMDL magic');
		}

		const header_length1 = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
		const header_length2 = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];

		if (
			header_length1 !== 120 ||
			header_length2 !== 120
		) {
			//throw new Error('Invalid FMDL header length');
		}

		stream.skip(4); // padding

		this.name = stream.parse_string(struct.unpack(`${stream.bom}I`, stream.bytes(4))[0] + 2);
		stream.skip(4); // padding
		this.eof_string = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.fskl_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.fvtx_array_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.fshp_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.fshp_index = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.fmat_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.fmat_index = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		this.user_data_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
		stream.skip(8); // padding
		stream.skip(8); // padding
		this.fvtx_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.fshp_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.fmat_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.param_count = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		this.vert_count = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
		stream.skip(4); // unknown

		stream.seek(this.fvtx_array_offset);
		for (let i = 0; i < this.fvtx_count; i++) {
			this.fvtxs.push(new FVTX(stream));
		}

		stream.seek(this.fmat_offset);
		for (let i = 0; i < this.fmat_count; i++) {
			this.fmats.push(new FMAT(stream));
		}

		stream.seek(this.fskl_offset);
		this.skeleton = new FSKL(stream);

		stream.seek(this.skeleton.inv_index_array_offset);
		for (let node = 0; node < this.skeleton.inv_index_array_count + this.skeleton.ex_index_count; node++) {
			this.nodes[node] = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
		}

		stream.seek(this.fshp_offset);
		for (let i = 0; i < this.fshp_count; i++) {
			this.fshps.push(new FSHP(stream));
		}

		for (const fshp of this.fshps) {
			const mesh = {
				name: stream.parse_string(fshp.poly_name_offset + 2),
				faces: [],
				vertices: [],
				texture_names: [],
			};

			const current_fvtx = this.fvtxs[fshp.fvtx_index];

			const attributes_array = [];
			stream.seek(current_fvtx.attribute_array_offset);
			for (let attribute = 0; attribute < current_fvtx.attribute_count; attribute++) {
				const attr = {
					type: stream.parse_string(struct.unpack(`${stream.bom}I`, stream.bytes(4))[0] + 2)
				};
				stream.skip(4); // padding
				attr.vertex_type = struct.unpack('>H', stream.bytes(2))[0]; // always BE
				stream.skip(2); // unknown
				attr.buffer_offset = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];
				attr.buffer_index = struct.unpack(`${stream.bom}H`, stream.bytes(2))[0];

				attributes_array.push(attr);
			}

			const buffer_array = [];
			stream.seek(current_fvtx.buffer_array_offset);
			for (let buffer = 0; buffer < current_fvtx.buffer_count; buffer++) {
				const buff = {};

				stream.seek(current_fvtx.buffer_size_offset + (buffer * 0x10));
				buff.buffer_size = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];

				stream.seek(current_fvtx.buffer_stride_size_offset + ((buffer) * 0x10));
				buff.stride_size = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];

				if (buffer == 0) {
					buff.data_offset = (stream.relocation_table.data_start + current_fvtx.buffer_offset);
				}
				if (buffer > 0) {
					buff.data_offset = buffer_array[buffer - 1].data_offset + buffer_array[buffer - 1].buffer_size;
				}
				if (buff.data_offset % 8 != 0) {
					buff.data_offset = buff.data_offset + (8 - (buff.data_offset % 8));
				}

				buffer_array.push(buff);
			}

			for (let v = 0; v < current_fvtx.vertex_count; v++) {
				const vert = {
					tx: [],
					node: [],
					weight: [],
					pos: new Vec3(0, 0, 0),
					nrm: new Vec3(0, 0, 0)
				};
				for (const attribute of attributes_array) {
					stream.seek(
						buffer_array[attribute.buffer_index].data_offset +
						attribute.buffer_offset +
						(buffer_array[attribute.buffer_index].stride_size * v)
					);

					switch (attribute.type) {
						case '_p0':
							if (attribute.vertex_type == 1301) {
								vert.pos = new Vec3(
									decodeFloat16(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0]),
									decodeFloat16(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0]),
									decodeFloat16(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0])
								);
							}
								
							if (attribute.vertex_type == 1304) {
								vert.pos = new Vec3(
									struct.unpack(`${stream.bom}f`, stream.bytes(4))[0],
									struct.unpack(`${stream.bom}f`, stream.bytes(4))[0],
									struct.unpack(`${stream.bom}f`, stream.bytes(4))[0]
								);
							}
							break;
						case '_c0':
							if (attribute.vertex_type == 1301) {
								vert.col = Vec4.create(
									decodeFloat16(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0]),
									decodeFloat16(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0]),
									decodeFloat16(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0]),
									decodeFloat16(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0])
								);
							}
							if (attribute.vertex_type == 2067) {
								vert.col = Vec4.create(
									struct.unpack(`${stream.bom}f`, stream.bytes(4))[0],
									struct.unpack(`${stream.bom}f`, stream.bytes(4))[0],
									struct.unpack(`${stream.bom}f`, stream.bytes(4))[0],
									struct.unpack(`${stream.bom}f`, stream.bytes(4))[0]
								);
							}
							if (attribute.vertex_type == 267) {
								vert.col = Vec4.create(
									stream.UInt8() / 255.00,
									stream.UInt8() / 255.00,
									stream.UInt8() / 255.00,
									stream.UInt8() / 255.00
								);
							}
							break;
						case '_n0':
							if (attribute.vertex_type == 526) {
								const normal = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
								vert.nrm = new Vec3(
									sign10Bit((normal) & 0x3FF) / 511.00,
									sign10Bit((normal >> 10) & 0x3FF) / 511.00,
									sign10Bit((normal >> 20) & 0x3FF) / 511.00
								);
							}
							break;
						case '_u0':
						case '_u1':
						case '_u2':
						case '_u3':
						case '_b0':
						case '_t0':
						case 'color':
							if (attribute.vertex_type == 265 || attribute.vertex_type == 521) {
								vert.tx.push(Vec2(
									stream.UInt8() / 255,
									stream.UInt8() / 255
								));
							}
							if (attribute.vertex_type == 274) {
								vert.tx.push(Vec2(
									struct.unpack(`${stream.bom}H`, stream.bytes(2))[0] / 65535,
									struct.unpack(`${stream.bom}H`, stream.bytes(2))[0] / 65535
								));
							}
							if (attribute.vertex_type == 530) {
								vert.tx.push(Vec2(
									struct.unpack(`${stream.bom}H`, stream.bytes(2))[0] / 32767,
									struct.unpack(`${stream.bom}H`, stream.bytes(2))[0] / 32767
								));
							}
							if (attribute.vertex_type == 1298) {
								vert.tx.push(Vec2(
									decodeFloat16(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0]),
									decodeFloat16(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0])
								));
							}
							if (attribute.vertex_type == 1303) {
								vert.tx.push(Vec2(
									struct.unpack(`${stream.bom}f`, stream.bytes(4))[0],
									struct.unpack(`${stream.bom}f`, stream.bytes(4))[0]
								));
							}
							break;
						case '_i0':
							if (attribute.vertex_type == 770) {
								vert.node.push(stream.UInt8());
								vert.weight.push(1.0);
							}
							if (attribute.vertex_type == 777) {
								vert.node.push(stream.UInt8());
								vert.node.push(stream.UInt8());
							}
							if (attribute.vertex_type == 779) {
								vert.node.push(stream.UInt8());
								vert.node.push(stream.UInt8());
								vert.node.push(stream.UInt8());
								vert.node.push(stream.UInt8());
							}
							if (attribute.vertex_type == 523) {
								vert.node.push(stream.UInt8());
								vert.node.push(stream.UInt8());
								vert.node.push(stream.UInt8());
								vert.node.push(stream.UInt8());
							}
							break;
						case '_w0':
							if (attribute.vertex_type == 258) {
								vert.weight.push(stream.UInt8() / 255.00);
							}
							if (attribute.vertex_type == 265) {
								vert.weight.push(stream.UInt8() / 255.00);
								vert.weight.push(stream.UInt8() / 255.00);
							}
							if (attribute.vertex_type == 267) {
								vert.weight.push(stream.UInt8() / 255.00);
								vert.weight.push(stream.UInt8() / 255.00);
								vert.weight.push(stream.UInt8() / 255.00);
								vert.weight.push(stream.UInt8() / 255.00);
							}
							if (attribute.vertex_type == 274) {
								vert.weight.push(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0] / 255.00);
								vert.weight.push(struct.unpack(`${stream.bom}H`, stream.bytes(2))[0] / 255.00);
							}
							break;
						default:
							break;
					}
				}

				mesh.vertices.push(vert);
			}

			const last_lod_model = fshp.lod_model_count - 1;

			stream.seek(fshp.lod_model_offset);
			for (let lod = 0; lod < fshp.lod_model_count; lod++) {
				const sub_mesh_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
				stream.skip(8); // unknown
				stream.skip(8); // unknown
				const indx_buffer_offset = struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber();
				const face_buffer = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
				const primative_face_type = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
				const face_type = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
				let face_count = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
				const element_skip = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
				const sub_mesh_count = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];

				const real_pos = stream.pos;



				stream.seek(face_buffer + stream.relocation_table.data_start);
				if (face_type == 1) {
					face_count = face_count / 3;
				}
				if (face_type == 2) {
					face_count = face_count / 6;
				}


				if (lod == last_lod_model) {
					for (let face = 0; face < face_count; face++) {
						if (face_type == 1) {
							mesh.faces.push([
								element_skip + struct.unpack(`${stream.bom}H`, stream.bytes(2))[0],
								element_skip + struct.unpack(`${stream.bom}H`, stream.bytes(2))[0],
								element_skip + struct.unpack(`${stream.bom}H`, stream.bytes(2))[0]
							]);
						} else if (face_type == 2) {
							mesh.faces.push([
								element_skip + struct.unpack(`${stream.bom}I`, stream.bytes(4))[0],
								element_skip + struct.unpack(`${stream.bom}I`, stream.bytes(4))[0],
								element_skip + struct.unpack(`${stream.bom}I`, stream.bytes(4))[0]
							]);
						} else {
							console.log(`Unknown face type ${face_type}`);
						}
					}
				}

				stream.seek(real_pos);
			}

			stream.seek(this.fmats[fshp.fmat_index].texture_sel_offset);
			const MatTexList = [];
			for (let tex = 0; tex < this.fmats[fshp.fmat_index].texture_attribute_sel_count; tex++) {
				const texture_name = stream.parse_string(struct.unpack(`${stream.bom}Q`, stream.bytes(8))[0].toNumber() + 2).toLowerCase();
				MatTexList.push(texture_name);
			}

			if (MatTexList.length > 0) {
				mesh.texture_names.push(MatTexList[0]);
			}
			
			this.polygons.push(mesh);
		}
	}
}

module.exports = FMDL;

// https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
function decodeFloat16(binary) {
	const exponent = (binary & 0x7C00) >> 10;
	const fraction = binary & 0x03FF;
	return (binary >> 15 ? -1 : 1) * (
		exponent ? (
			exponent === 0x1F ?
				fraction ? NaN : Infinity :
				Math.pow(2, exponent - 15) * (1 + fraction / 0x400)
		) :
			6.103515625e-5 * (fraction / 0x400)
	);
}

function sign10Bit(i) {
	if (((i >> 9) & 0x1) == 1) {
		i = ~i;
		i = i & 0x3FF;
		i += 1;
		i *= -1;
	}

	return i;
}