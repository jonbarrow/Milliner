const struct = require('python-struct');

const BNTX_MAGIC = 'BNTX';
const NX_MAGIC = 'NX';
const BRTI_MAGIC = 'BRTI';
const BYTE_ORDER = {
	BIG: 0xFEFF,
	LITTLE: 0xFFFE
};

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

class BNTX {
	constructor(stream) {
		this.offset = stream.pos; // binary texture offsets are relative to the texture start!
		this.textures = [];
		this.bom = stream.bom;
		
		let magic = stream.String(4);
		if (magic != BNTX_MAGIC) {
			throw new Error('File not BNTX file');
		}
		
		stream.skip(4); // padding
		const real_pos = stream.pos;
		stream.skip(4); // length. skip for now

		if (stream.UInt16BE() == BYTE_ORDER.BIG) {
			this.bom = '>';
		} else {
			this.bom = '<';
		}

		stream.seek(real_pos); // going back!
		
		this.data_length = struct.unpack(`${this.bom}I`, stream.bytes(4))[0];
		stream.skip(2); // bom, already read
		this.format_revision = struct.unpack(`${this.bom}H`, stream.bytes(2))[0];
		this.name_address = struct.unpack(`${this.bom}I`, stream.bytes(4))[0];
		this.strings_address = struct.unpack(`${this.bom}I`, stream.bytes(4))[0] >> 16;
		this.reloc_address = struct.unpack(`${this.bom}I`, stream.bytes(4))[0];
		this.file_length = struct.unpack(`${this.bom}I`, stream.bytes(4))[0];

		this.name = stream.parse_string(this.offset + this.name_address);

		magic = stream.String(2);
		if (magic != NX_MAGIC) {
			throw new Error('Failed to find NX header');
		}

		stream.skip(2); // padding
		this.texture_count = struct.unpack(`${this.bom}I`, stream.bytes(4))[0];
		this.info_address = struct.unpack(`${this.bom}Q`, stream.bytes(8))[0].toNumber();
		this.data_block_address = struct.unpack(`${this.bom}Q`, stream.bytes(8))[0].toNumber();
		this.dict_address = struct.unpack(`${this.bom}Q`, stream.bytes(8))[0].toNumber();
		this.string_dict_length = struct.unpack(`${this.bom}I`, stream.bytes(4))[0];

		for (let i = 0; i < this.texture_count; i++) {
			stream.seek(this.offset + (this.info_address + (i * 8)));
			stream.seek(this.offset + struct.unpack(`${this.bom}Q`, stream.bytes(8))[0].toNumber());

			const new_texture = new Texture(stream);

			stream.seek(this.offset + new_texture.name_address);
			new_texture.name = stream.String(struct.unpack(`${this.bom}H`, stream.bytes(2))[0]);
			stream.seek(this.offset + new_texture.ptrs_address);

			const base_offset = struct.unpack(`${this.bom}Q`, stream.bytes(8))[0].toNumber();

			for (let mip = 1; mip < new_texture.mipmap_count; mip++) {
				new_texture.mip_offsets[mip] = struct.unpack(`${this.bom}Q`, stream.bytes(8))[0].toNumber() - base_offset;
			}

			stream.seek(this.offset + base_offset);

			new_texture.data = stream.bytes(new_texture.data_length);

			this.textures.push(new_texture);
		}
	}
}

class Texture {
	constructor(stream) {
		this.mip_offsets = [];

		const magic = stream.String(4);
		if (magic != BRTI_MAGIC) {
			throw new Error('Failed to find BRTI header');
		}

		this.BRTI_length_0 = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.BRTI_length_1 = struct.unpack(`${stream.bom}q`, stream.bytes(8))[0].toNumber();
		this.flags = stream.Int8();
		this.dimensions = stream.Int8();
		this.tile_mode = struct.unpack(`${stream.bom}h`, stream.bytes(2))[0];
		this.swizzle_size = struct.unpack(`${stream.bom}h`, stream.bytes(2))[0];
		this.mipmap_count = struct.unpack(`${stream.bom}h`, stream.bytes(2))[0];
		this.multi_sample_count = struct.unpack(`${stream.bom}h`, stream.bytes(2))[0];
		this.reversed_1A = struct.unpack(`${stream.bom}h`, stream.bytes(2))[0];

		this.format = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
		this.access_flags = struct.unpack(`${stream.bom}I`, stream.bytes(4))[0];
		this.width = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.height = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.depth = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.array_count = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.block_height_log_2 = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.reserved_38 = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.reserved_3C = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.reserved_40 = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.reserved_44 = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.reserved_48 = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.reserved_4C = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.data_length = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.alignment = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.channel_types = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.texture_type = struct.unpack(`${stream.bom}i`, stream.bytes(4))[0];
		this.name_address = struct.unpack(`${stream.bom}q`, stream.bytes(8))[0].toNumber();
		this.parent_address = struct.unpack(`${stream.bom}q`, stream.bytes(8))[0].toNumber();
		this.ptrs_address = struct.unpack(`${stream.bom}q`, stream.bytes(8))[0].toNumber();

		this.channel_0_type = (this.channel_types >>  0) & 0xff;
		this.channel_1_type = (this.channel_types >>  8) & 0xff;
		this.channel_2_type = (this.channel_types >> 16) & 0xff;
		this.channel_3_type = (this.channel_types >> 24) & 0xff;

		this.format_type = (this.format >> 8) & 0xff;
		this.format_variant = (this.format >> 0) & 0xff;
	}

	getSwizzle() {
		return new BlockLinearSwizzle(this.getWidthInTexels(), this.getBytesPerTexel(), this.getBlockHeight());
	}

	getWidthInTexels() {
		switch (this.format_type) {
			case TEXTURE_FORMAT_TYPES.BC1:
			case TEXTURE_FORMAT_TYPES.BC2:
			case TEXTURE_FORMAT_TYPES.BC3:
			case TEXTURE_FORMAT_TYPES.BC4:
			case TEXTURE_FORMAT_TYPES.BC5:
			case TEXTURE_FORMAT_TYPES.ASTC4x4:
				return (this.width + 3) / 4;
		
			case TEXTURE_FORMAT_TYPES.ASTC5x4:
			case TEXTURE_FORMAT_TYPES.ASTC5x5:
				return (this.width + 4) / 5;
		
			case TEXTURE_FORMAT_TYPES.ASTC6x5:
			case TEXTURE_FORMAT_TYPES.ASTC6x6:
				return (this.width + 5) / 6;
		
			case TEXTURE_FORMAT_TYPES.ASTC8x5:
			case TEXTURE_FORMAT_TYPES.ASTC8x6:
			case TEXTURE_FORMAT_TYPES.ASTC8x8:
				return (this.width + 7) / 8;
		
			case TEXTURE_FORMAT_TYPES.ASTC10x5:
			case TEXTURE_FORMAT_TYPES.ASTC10x6:
			case TEXTURE_FORMAT_TYPES.ASTC10x8:
			case TEXTURE_FORMAT_TYPES.ASTC10x10:
				return (this.width + 9) / 10;
		
			case TEXTURE_FORMAT_TYPES.ASTC12x10:
			case TEXTURE_FORMAT_TYPES.ASTC12x12:
				return (this.width + 11) / 12;
		}
		
		return this.width;
	}

	getPow2HeightInTexels() {
		const pow_2_height = Math.pow(this.height, 2);

		switch (this.format_type) {
			case TEXTURE_FORMAT_TYPES.BC1:
			case TEXTURE_FORMAT_TYPES.BC2:
			case TEXTURE_FORMAT_TYPES.BC3:
			case TEXTURE_FORMAT_TYPES.BC4:
			case TEXTURE_FORMAT_TYPES.BC5:
			case TEXTURE_FORMAT_TYPES.ASTC4x4:
			case TEXTURE_FORMAT_TYPES.ASTC5x4:
				return (pow_2_height + 3) / 4;

			case TEXTURE_FORMAT_TYPES.ASTC5x5:
			case TEXTURE_FORMAT_TYPES.ASTC6x5:
			case TEXTURE_FORMAT_TYPES.ASTC8x5:
				return (pow_2_height + 4) / 5;

			case TEXTURE_FORMAT_TYPES.ASTC6x6:
			case TEXTURE_FORMAT_TYPES.ASTC8x6:
			case TEXTURE_FORMAT_TYPES.ASTC10x6:
				return (pow_2_height + 5) / 6;

			case TEXTURE_FORMAT_TYPES.ASTC8x8:
			case TEXTURE_FORMAT_TYPES.ASTC10x8:
				return (pow_2_height + 7) / 8;

			case TEXTURE_FORMAT_TYPES.ASTC10x10:
			case TEXTURE_FORMAT_TYPES.ASTC12x10:
				return (pow_2_height + 9) / 10;

			case TEXTURE_FORMAT_TYPES.ASTC12x12:
				return (pow_2_height + 11) / 12;
		}

		return pow_2_height;
	}

	getBytesPerTexel() {
		switch (this.format_type) {
			case TEXTURE_FORMAT_TYPES.R5G6B5:
			case TEXTURE_FORMAT_TYPES.R8G8:
			case TEXTURE_FORMAT_TYPES.R16:
				return 2;
		
			case TEXTURE_FORMAT_TYPES.R8G8B8A8:
			case TEXTURE_FORMAT_TYPES.R11G11B10:
			case TEXTURE_FORMAT_TYPES.R32:
				return 4;
		
			case TEXTURE_FORMAT_TYPES.BC1:
			case TEXTURE_FORMAT_TYPES.BC4:
				return 8;
		
			case TEXTURE_FORMAT_TYPES.BC2:
			case TEXTURE_FORMAT_TYPES.BC3:
			case TEXTURE_FORMAT_TYPES.BC5:
			case TEXTURE_FORMAT_TYPES.ASTC4x4:
			case TEXTURE_FORMAT_TYPES.ASTC5x4:
			case TEXTURE_FORMAT_TYPES.ASTC5x5:
			case TEXTURE_FORMAT_TYPES.ASTC6x5:
			case TEXTURE_FORMAT_TYPES.ASTC6x6:
			case TEXTURE_FORMAT_TYPES.ASTC8x5:
			case TEXTURE_FORMAT_TYPES.ASTC8x6:
			case TEXTURE_FORMAT_TYPES.ASTC8x8:
			case TEXTURE_FORMAT_TYPES.ASTC10x5:
			case TEXTURE_FORMAT_TYPES.ASTC10x6:
			case TEXTURE_FORMAT_TYPES.ASTC10x8:
			case TEXTURE_FORMAT_TYPES.ASTC10x10:
			case TEXTURE_FORMAT_TYPES.ASTC12x10:
			case TEXTURE_FORMAT_TYPES.ASTC12x12:
				return 16;
		}

		throw new Error(`Texture format ${this.format_type} not implemented`);
	}

	getBlockHeight() {
		return 1 << this.block_height_log_2;
	}

}

class BlockLinearSwizzle {
	constructor(width, bpp, block_height = 16) {
		this.bh_mask = (block_height * 8) - 1;

		this.bh_shift = this.countLsbZeros(block_height * 8);
		this.bpp_shift = this.countLsbZeros(bpp);

		const GOD_width = Math.ceil(width * bpp / 64.00);

		this.stride = 512 * block_height * GOD_width;

		this.x_shift = this.countLsbZeros(512 * block_height);
	}

	countLsbZeros(val) {
		let count = 0;

		while (((val >> count) & 1) == 0) {
			count++;
		}

		return count;
	}

	getSwizzleOffset(x, y) {
		x <<= this.bpp_shift;

		let pos = (y >> this.bh_shift) * this.stride;

		pos += (x >> 6) << this.x_shift;

		pos += ((y & this.bh_mask) >> 3) << 9;

		pos += ((x & 0x3f) >> 5) << 8;
		pos += ((y & 0x07) >> 1) << 6;
		pos += ((x & 0x1f) >> 4) << 5;
		pos += ((y & 0x01) >> 0) << 4;
		pos += ((x & 0x0f) >> 0) << 0;

		return pos;
	}
}

module.exports = BNTX;