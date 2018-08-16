module.exports = {
	decompress,
	compress
};

const YAZ0_MAGIC = Buffer.from('59617A30', 'hex'); // Yaz0

function decompress(buffer) {
	const magic = buffer.subarray(0, 4);
	if (!magic.equals(YAZ0_MAGIC)) {
		throw new Error('File not Yaz0 compressed file');
	}

	let src = 16;
	const src_end = buffer.length;

	let dest = 0;
	const dest_end = buffer.readUInt32BE(0x04);
	let group_header = 0;
	let group_len = 0;

	const out = [];

	while (src < src_end && dest < dest_end) {
		if (!group_len) {
			group_header = buffer[src++];
			group_len = 8;
		}

		group_len--;
		if (group_header & 0x80) {
			out[dest++] = buffer[src++];
		} else {
			const b1 = buffer[src++];
			const b2 = buffer[src++];
			
			let copy_src = dest - (( b1 & 0x0f ) << 8 | b2 ) - 1;

			let n = b1 >> 4;

			if (!n) {
				n = buffer[src++] + 0x12;
			} else {
				n += 2;
			}
			while ( n --> 0 ) {
				out[dest++] = out[copy_src++];
			}
		}
		group_header <<= 1;
	}

	return Buffer.from(out);
}

function compress() {}