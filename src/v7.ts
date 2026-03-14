// Shared V7 UUID byte generation per RFC 9562 Section 6.2 Method 3.

export function buildV7(lastSeq: number): [bytes: Uint8Array, seq: number] {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes.subarray(8));

	const ms = Date.now();
	let frac = 0;
	if (typeof performance !== "undefined") {
		frac = Math.floor((performance.now() % 1) * 4096);
	}
	let seq = ms * 4096 + frac;

	if (seq <= lastSeq) {
		seq = lastSeq + 1;
	}

	const seqMs = Math.floor(seq / 4096);
	const seq12 = seq % 4096;

	bytes[0] = Math.floor(seqMs / 0x10000000000) % 256;
	bytes[1] = Math.floor(seqMs / 0x100000000) % 256;
	bytes[2] = Math.floor(seqMs / 0x1000000) % 256;
	bytes[3] = Math.floor(seqMs / 0x10000) % 256;
	bytes[4] = Math.floor(seqMs / 0x100) % 256;
	bytes[5] = seqMs % 256;
	bytes[6] = 0x70 | ((seq12 >> 8) & 0x0f);
	bytes[7] = seq12 & 0xff;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	return [bytes, seq];
}
