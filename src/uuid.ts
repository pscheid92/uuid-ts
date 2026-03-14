// RFC 9562 UUID implementation: types, generation, parsing, and comparison.

import { buildV7 } from "./v7.js";

export enum Version {
	NIL = 0,
	V4 = 4,
	V5 = 5,
	V7 = 7,
	V8 = 8,
	MAX = 15,
}

export enum Variant {
	NCS = 0,
	RFC9562 = 1,
	Microsoft = 2,
	Future = 3,
}

// --- Hex encoding/decoding helpers (module-private) ---

const HEX = "0123456789abcdef";

const XVALUES = new Uint8Array(256).fill(0xff);
for (let i = 0; i <= 9; i++) XVALUES[0x30 + i] = i; // '0'-'9'
for (let i = 0; i < 6; i++) XVALUES[0x41 + i] = 10 + i; // 'A'-'F'
for (let i = 0; i < 6; i++) XVALUES[0x61 + i] = 10 + i; // 'a'-'f'

const HEX_OFFSETS = [0, 2, 4, 6, 9, 11, 14, 16, 19, 21, 24, 26, 28, 30, 32, 34];

function xtob(x1: number, x2: number): [number, boolean] {
	const b1 = XVALUES[x1];
	const b2 = XVALUES[x2];
	return [(b1 << 4) | b2, b1 !== 0xff && b2 !== 0xff];
}

function decodeHex(s: string, offset: number): Uint8Array | null {
	if (
		s[offset + 8] !== "-" ||
		s[offset + 13] !== "-" ||
		s[offset + 18] !== "-" ||
		s[offset + 23] !== "-"
	) {
		return null;
	}
	const bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		const x = HEX_OFFSETS[i] + offset;
		const [v, ok] = xtob(s.charCodeAt(x), s.charCodeAt(x + 1));
		if (!ok) return null;
		bytes[i] = v;
	}
	return bytes;
}

function decodeCompact(s: string): Uint8Array | null {
	const bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		const [v, ok] = xtob(s.charCodeAt(i * 2), s.charCodeAt(i * 2 + 1));
		if (!ok) return null;
		bytes[i] = v;
	}
	return bytes;
}

let v7LastSeq = 0;

// --- UUID class ---

/** A 128-bit universally unique identifier per RFC 9562. */
export class UUID {
	readonly #bytes: Uint8Array;

	private constructor(bytes: Uint8Array) {
		this.#bytes = bytes;
	}

	// --- Constants ---

	static readonly nil = new UUID(new Uint8Array(16));
	static readonly max = new UUID(new Uint8Array(16).fill(0xff));

	static readonly namespaceDNS = new UUID(
		new Uint8Array([
			0x6b, 0xa7, 0xb8, 0x10, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0,
			0x4f, 0xd4, 0x30, 0xc8,
		]),
	);
	static readonly namespaceURL = new UUID(
		new Uint8Array([
			0x6b, 0xa7, 0xb8, 0x11, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0,
			0x4f, 0xd4, 0x30, 0xc8,
		]),
	);
	static readonly namespaceOID = new UUID(
		new Uint8Array([
			0x6b, 0xa7, 0xb8, 0x12, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0,
			0x4f, 0xd4, 0x30, 0xc8,
		]),
	);
	static readonly namespaceX500 = new UUID(
		new Uint8Array([
			0x6b, 0xa7, 0xb8, 0x14, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0,
			0x4f, 0xd4, 0x30, 0xc8,
		]),
	);

	// --- Generation ---

	/** Returns a new random (Version 4) UUID. */
	static v4(): UUID {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		return new UUID(bytes);
	}

	/** Returns a deterministic Version 5 (SHA-1) UUID for the given namespace and name. */
	static async v5(namespace: UUID, name: string): Promise<UUID> {
		const nameBytes = new TextEncoder().encode(name);
		const input = new Uint8Array(16 + nameBytes.length);
		input.set(namespace.#bytes);
		input.set(nameBytes, 16);

		const hash = await crypto.subtle.digest("SHA-1", input);
		const bytes = new Uint8Array(hash, 0, 16);
		bytes[6] = (bytes[6] & 0x0f) | 0x50;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		return new UUID(bytes);
	}

	/**
	 * Returns a new Version 7 (Unix timestamp + random) UUID.
	 * Uses a module-level monotonicity counter. For isolated
	 * monotonicity guarantees, use a Generator instance.
	 */
	static v7(): UUID {
		const [bytes, seq] = buildV7(v7LastSeq);
		v7LastSeq = seq;
		return new UUID(bytes);
	}

	/**
	 * Returns a Version 8 UUID constructed from user-provided data.
	 * The version and variant bits are set; all other 122 bits come from data.
	 */
	static v8(data: Uint8Array): UUID {
		if (data.length !== 16) {
			throw new Error("v8 data must be exactly 16 bytes");
		}
		const bytes = data.slice();
		bytes[6] = (bytes[6] & 0x0f) | 0x80;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		return new UUID(bytes);
	}

	// --- Parsing ---

	/**
	 * Parses a UUID from the standard 36-character hyphenated form.
	 * For URN, braced, or compact forms, use UUID.parseLenient().
	 */
	static parse(s: string): UUID {
		if (s.length !== 36) {
			throw new ParseError(s, "expected 36-character hyphenated format");
		}
		const bytes = decodeHex(s, 0);
		if (!bytes) {
			throw new ParseError(s, "invalid format or hex character");
		}
		return new UUID(bytes);
	}

	/**
	 * Parses a UUID from standard, URN, braced, or compact form.
	 */
	static parseLenient(s: string): UUID {
		let bytes: Uint8Array | null;

		switch (s.length) {
			case 36:
				bytes = decodeHex(s, 0);
				break;
			case 45:
				if (s.substring(0, 9) !== "urn:uuid:") {
					throw new ParseError(s, "expected urn:uuid: prefix");
				}
				bytes = decodeHex(s, 9);
				break;
			case 38:
				if (s[0] !== "{" || s[37] !== "}") {
					throw new ParseError(s, "expected braces");
				}
				bytes = decodeHex(s, 1);
				break;
			case 32:
				bytes = decodeCompact(s);
				break;
			default:
				throw new ParseError(s, "unrecognized UUID format");
		}

		if (!bytes) {
			throw new ParseError(s, "invalid format or hex character");
		}
		return new UUID(bytes);
	}

	/** Creates a UUID from a 16-byte Uint8Array (copies the input). */
	static fromBytes(bytes: Uint8Array): UUID {
		if (bytes.length !== 16) {
			throw new LengthError(bytes.length, "16 bytes");
		}
		return new UUID(bytes.slice());
	}

	// --- Comparison ---

	/** Compares two UUIDs lexicographically. Returns -1, 0, or 1. */
	static compare(a: UUID, b: UUID): number {
		for (let i = 0; i < 16; i++) {
			if (a.#bytes[i] < b.#bytes[i]) return -1;
			if (a.#bytes[i] > b.#bytes[i]) return 1;
		}
		return 0;
	}

	// --- Instance methods ---

	get version(): Version {
		return (this.#bytes[6] >> 4) as Version;
	}

	get variant(): Variant {
		const b = this.#bytes[8];
		if ((b & 0x80) === 0x00) return Variant.NCS;
		if ((b & 0xc0) === 0x80) return Variant.RFC9562;
		if ((b & 0xe0) === 0xc0) return Variant.Microsoft;
		return Variant.Future;
	}

	get isNil(): boolean {
		for (let i = 0; i < 16; i++) {
			if (this.#bytes[i] !== 0) return false;
		}
		return true;
	}

	/** Returns a copy of the UUID as a 16-byte Uint8Array. */
	bytes(): Uint8Array {
		return this.#bytes.slice();
	}

	/**
	 * Extracts the millisecond-precision Unix timestamp from a V7 UUID.
	 * For non-V7 UUIDs, the returned Date is meaningless.
	 */
	time(): Date {
		const b = this.#bytes;
		const ms =
			b[0] * 0x10000000000 +
			b[1] * 0x100000000 +
			b[2] * 0x1000000 +
			b[3] * 0x10000 +
			b[4] * 0x100 +
			b[5];
		return new Date(ms);
	}

	toString(): string {
		const b = this.#bytes;
		const h = HEX;
		return (
			h[b[0] >> 4] +
			h[b[0] & 0xf] +
			h[b[1] >> 4] +
			h[b[1] & 0xf] +
			h[b[2] >> 4] +
			h[b[2] & 0xf] +
			h[b[3] >> 4] +
			h[b[3] & 0xf] +
			"-" +
			h[b[4] >> 4] +
			h[b[4] & 0xf] +
			h[b[5] >> 4] +
			h[b[5] & 0xf] +
			"-" +
			h[b[6] >> 4] +
			h[b[6] & 0xf] +
			h[b[7] >> 4] +
			h[b[7] & 0xf] +
			"-" +
			h[b[8] >> 4] +
			h[b[8] & 0xf] +
			h[b[9] >> 4] +
			h[b[9] & 0xf] +
			"-" +
			h[b[10] >> 4] +
			h[b[10] & 0xf] +
			h[b[11] >> 4] +
			h[b[11] & 0xf] +
			h[b[12] >> 4] +
			h[b[12] & 0xf] +
			h[b[13] >> 4] +
			h[b[13] & 0xf] +
			h[b[14] >> 4] +
			h[b[14] & 0xf] +
			h[b[15] >> 4] +
			h[b[15] & 0xf]
		);
	}

	toURN(): string {
		return `urn:uuid:${this.toString()}`;
	}

	toJSON(): string {
		return this.toString();
	}

	equals(other: UUID): boolean {
		for (let i = 0; i < 16; i++) {
			if (this.#bytes[i] !== other.#bytes[i]) return false;
		}
		return true;
	}
}

// --- Error types ---

/** Returned when a UUID string cannot be parsed. */
export class ParseError extends Error {
	readonly input: string;
	readonly msg: string;

	constructor(input: string, msg: string) {
		super(`uuid: parsing "${input}": ${msg}`);
		this.name = "ParseError";
		this.input = input;
		this.msg = msg;
	}
}

/** Returned when the input has an unexpected byte length. */
export class LengthError extends Error {
	readonly got: number;
	readonly want: string;

	constructor(got: number, want: string) {
		super(`uuid: unexpected length ${got}, want ${want}`);
		this.name = "LengthError";
		this.got = got;
		this.want = want;
	}
}
