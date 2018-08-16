const struct = require('python-struct');

const FILE_MAGICS = {
	BNTX: Buffer.from('BNTX\0\0\0\0'),
	BNSH: Buffer.from('BNSH\0\0\0\0'),
	MSG_STD_BN: Buffer.from('MsgStdBn'),
	MSG_PRJ_BN: Buffer.from('MsgPrjBn'),
	SARC: Buffer.from('SARC'),
	FFNT: Buffer.from('FFNT'),
	CFNT: Buffer.from('CFNT'),
	CSTM: Buffer.from('CSTM'),
	FSTM: Buffer.from('FSTM'),
	FSTP: Buffer.from('FSTP'),
	CWAV: Buffer.from('CWAV'),
	FWAV: Buffer.from('FWAV'),
	GfX2: Buffer.from('Gfx2'),
	FRES: Buffer.from('FRES'),
	AAHS: Buffer.from('AAHS'),
	BAHS: Buffer.from('BAHS'),
	FSHA: Buffer.from('FSHA'),
	FLAN: Buffer.from('FLAN'),
	FLYT: Buffer.from('FLYT'),
	CLAN: Buffer.from('CLAN'),
	CLYT: Buffer.from('CLYT'),
	CTPK: Buffer.from('CTPK'),
	CGFX: Buffer.from('CGFX'),
	AAMP: Buffer.from('AAMP'),
	FLIM: Buffer.from('FLIM'),
	CLIM: Buffer.from('CLIM'),
	YAZ0: Buffer.from('Yaz0'),
	YAZ1: Buffer.from('Yaz1'),
	YB: Buffer.from('YB'),
	BY: Buffer.from('BY'),
	SFAT: Buffer.from('SFAT'),
	SFNT: Buffer.from('SFNT')
};

const BYTE_ORDER = {
	BIG: Buffer.from('FEFF', 'hex'),
	LITTLE: Buffer.from('FFFE', 'hex')
};

class SARCArchive {
	constructor(archive) {
		this.packed = archive;

		this.header_length = 0;
		this.bom = null;
		this.archive_size = 0;
		this.data_offset = 0;
		this.version = 0;

		this.sfat_header_length = 0;
		this.node_count = 0;
		this.hash_key = null;

		this.sfnt_header_length = 0;

		this.nodes = [];
		this.files = [];

		this.unpack();
	}

	unpack() {
		const sarc_header_buffer = this.packed.subarray(0x00, 0x14);
		const sfat_header_buffer = this.packed.subarray(0x14, 0x20);

		let magic = sarc_header_buffer.subarray(0, 4);
		if (!magic.equals(FILE_MAGICS.SARC)) {
			throw new Error('File not SARC archive');
		}

		this.bom = (sarc_header_buffer.subarray(0x06, 0x08).equals(BYTE_ORDER.BIG) ? '>' : '<');
		this.header_length = struct.unpack(`${this.bom}H`, sarc_header_buffer.subarray(0x04, 0x06))[0];
		this.archive_size = struct.unpack(`${this.bom}I`, sarc_header_buffer.subarray(0x08, 0x0C))[0];
		this.data_offset = struct.unpack(`${this.bom}I`, sarc_header_buffer.subarray(0x0C, 0x10))[0];
		this.version = struct.unpack(`${this.bom}H`, sarc_header_buffer.subarray(0x10, 0x12))[0];

		if (
			this.header_length !== 0x14 ||
			this.archive_size !== this.packed.length ||
			this.version !== 0x0100
		) {
			throw new Error('Malformed SARC header');
		}

		magic = sfat_header_buffer.subarray(0, 4);
		if (!magic.equals(FILE_MAGICS.SFAT)) {
			throw new Error('Could not find SFAT header data');
		}

		this.sfat_header_length = struct.unpack(`${this.bom}H`, sfat_header_buffer.subarray(0x04, 0x06))[0];
		this.node_count = struct.unpack(`${this.bom}H`, sfat_header_buffer.subarray(0x06, 0x08))[0];
		this.hash_key = struct.unpack(`${this.bom}I`, sfat_header_buffer.subarray(0x08, 0x0C))[0];

		if (
			this.sfat_header_length !== 0x0C ||
			this.hash_key !== 0x00000065
		) {
			throw new Error('Malformed SFAT header');
		}

		let node_offset = 0x20;
		let node_count = this.node_count;

		while (node_count --> 0) {
			const node_buffer = this.packed.subarray(node_offset, node_offset + 16);
			const node = {
				name_hash: struct.unpack(`${this.bom}I`, node_buffer.subarray(0x00, 0x04))[0],
				attributes: struct.unpack(`${this.bom}I`, node_buffer.subarray(0x04, 0x08))[0],
				data_start: struct.unpack(`${this.bom}I`, node_buffer.subarray(0x08, 0x0C))[0],
				data_end: struct.unpack(`${this.bom}I`, node_buffer.subarray(0x0C, 0x10))[0]
			};

			node.size = node.data_end - node.data_start;

			node.has_name = node.attributes >> 24;
			if (node.has_name) {
				node.name_table_offset = (node.attributes & 0xFFFFFF) * 4;
			}

			this.nodes.push(node);

			node_offset += 16;
		}

		const sfnt_header_buffer = this.packed.subarray(node_offset, node_offset + 0x08);
		magic = sfnt_header_buffer.subarray(0, 4);
		if (!magic.equals(FILE_MAGICS.SFNT)) {
			throw new Error('Could not find SFNT header data');
		}

		this.sfnt_header_length = struct.unpack(`${this.bom}H`, sfnt_header_buffer.subarray(0x04, 0x06))[0];
		
		if (this.sfnt_header_length !== 0x08) {
			throw new Error('Malformed SFNT header');
		}

		const name_table_offset = node_offset + 0x08;
		const data_content = this.packed.subarray(this.data_offset);

		for (const node of this.nodes) {
			const file = {
				data: data_content.subarray(node.data_start, node.size)
			};

			if (node.has_name) {
				const name_offset = name_table_offset + node.name_table_offset;
				const name_end = this.packed.subarray(name_offset).indexOf('\0');

				file.name = this.packed.subarray(name_offset, name_offset + name_end).toString();
			} else {
				file.name = `file-${node.name_hash}.${findFileType(file.data)}`;
			}

			this.files.push(file);
		}
	}

}

function findFileType(buffer) {
	if (buffer.subarray(0, 8).equals(FILE_MAGICS.BNTX)) {
		return '.bntx';
	}

	if (buffer.subarray(0, 8).equals(FILE_MAGICS.BNSH)) {
		return '.bnsh';
	}

	if (buffer.subarray(0, 8).equals(FILE_MAGICS.MsgStdBn)) {
		return '.msbt';
	}
		
	if (buffer.subarray(0, 8).equals(FILE_MAGICS.MsgPrjBn)) {
		return '.msbp';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.SARC)) {
		return '.sarc';
	}
		
	if (
		buffer.subarray(0, 4).equals(FILE_MAGICS.YAZ0) ||
		buffer.subarray(0, 4).equals(FILE_MAGICS.YAZ1)
	) {
		return '.szs';
	}
	
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.FFNT)) {
		return '.bffnt';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.CFNT)) {
		return '.bcfnt';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.CSTM)) {
		return '.bcstm';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.FSTM)) {
		return '.bfstm';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.FSTP)) {
		return '.bfstp';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.CWAV)) {
		return '.bcwav';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.FWAV)) {
		return '.bfwav';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.Gfx2)) {
		return '.gtx';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.FRES)) {
		return '.bfres';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.AAHS)) {
		return '.sharc';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.BAHS)) {
		return '.sharcfb';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.FSHA)) {
		return '.bfsha';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.FLAN)) {
		return '.bflan';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.FLYT)) {
		return '.bflyt';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.CLAN)) {
		return '.bclan';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.CLYT)) {
		return '.bclyt';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.CTPK)) {
		return '.ctpk';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.CGFX)) {
		return '.bcres';
	}
		
	if (buffer.subarray(0, 4).equals(FILE_MAGICS.AAMP)) {
		return '.aamp';
	}
		
	if (buffer.subarray(-0x28, -0x24).equals(FILE_MAGICS.FLIM)) {
		return '.bflim';
	}
		
	if (buffer.subarray(-0x28, -0x24).equals(FILE_MAGICS.CLIM)) {
		return '.bclim';
	}
		
	if (
		buffer.subarray(0, 2).equals(FILE_MAGICS.BY) ||
		buffer.subarray(0, 2).equals(FILE_MAGICS.YB)
	) {
		return '.byaml';
	}
	
	return '.bin';
}

module.exports = SARCArchive;