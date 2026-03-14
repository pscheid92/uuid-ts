import { describe, expect, it } from "vitest";
import { LengthError, ParseError, UUID, Variant, Version } from "./uuid.js";

// --- Constants ---

describe("UUID.nil", () => {
	it("is all zeros", () => {
		expect(UUID.nil.toString()).toBe("00000000-0000-0000-0000-000000000000");
	});

	it("isNil returns true", () => {
		expect(UUID.nil.isNil).toBe(true);
	});

	it("has version NIL", () => {
		expect(UUID.nil.version).toBe(Version.NIL);
	});
});

describe("UUID.max", () => {
	it("is all 0xFF", () => {
		expect(UUID.max.toString()).toBe("ffffffff-ffff-ffff-ffff-ffffffffffff");
	});

	it("isNil returns false", () => {
		expect(UUID.max.isNil).toBe(false);
	});

	it("has version MAX", () => {
		expect(UUID.max.version).toBe(Version.MAX);
	});
});

describe("namespace constants", () => {
	it("DNS matches RFC 9562", () => {
		expect(UUID.namespaceDNS.toString()).toBe(
			"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		);
	});

	it("URL matches RFC 9562", () => {
		expect(UUID.namespaceURL.toString()).toBe(
			"6ba7b811-9dad-11d1-80b4-00c04fd430c8",
		);
	});

	it("OID matches RFC 9562", () => {
		expect(UUID.namespaceOID.toString()).toBe(
			"6ba7b812-9dad-11d1-80b4-00c04fd430c8",
		);
	});

	it("X500 matches RFC 9562", () => {
		expect(UUID.namespaceX500.toString()).toBe(
			"6ba7b814-9dad-11d1-80b4-00c04fd430c8",
		);
	});
});

// --- Instance methods ---

describe("variant", () => {
	it("detects NCS variant", () => {
		const bytes = new Uint8Array(16);
		bytes[8] = 0x00;
		expect(UUID.fromBytes(bytes).variant).toBe(Variant.NCS);
	});

	it("detects RFC9562 variant", () => {
		const bytes = new Uint8Array(16);
		bytes[8] = 0x80;
		expect(UUID.fromBytes(bytes).variant).toBe(Variant.RFC9562);
	});

	it("detects Microsoft variant", () => {
		const bytes = new Uint8Array(16);
		bytes[8] = 0xc0;
		expect(UUID.fromBytes(bytes).variant).toBe(Variant.Microsoft);
	});

	it("detects Future variant", () => {
		const bytes = new Uint8Array(16);
		bytes[8] = 0xe0;
		expect(UUID.fromBytes(bytes).variant).toBe(Variant.Future);
	});
});

describe("bytes()", () => {
	it("returns a copy", () => {
		const u = UUID.parse("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
		const copy = u.bytes();
		copy[0] = 0xff;
		expect(u.bytes()[0]).toBe(0x6b);
	});
});

describe("toURN()", () => {
	it("returns URN form", () => {
		const u = UUID.parse("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
		expect(u.toURN()).toBe("urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8");
	});
});

describe("toJSON()", () => {
	it("returns string form", () => {
		const u = UUID.parse("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
		expect(u.toJSON()).toBe("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
	});

	it("works with JSON.stringify", () => {
		const u = UUID.parse("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
		expect(JSON.stringify({ id: u })).toBe(
			'{"id":"6ba7b810-9dad-11d1-80b4-00c04fd430c8"}',
		);
	});
});

describe("equals()", () => {
	it("returns true for equal UUIDs", () => {
		const a = UUID.parse("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
		const b = UUID.parse("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
		expect(a.equals(b)).toBe(true);
	});

	it("returns false for different UUIDs", () => {
		expect(UUID.nil.equals(UUID.max)).toBe(false);
	});
});

// --- Comparison ---

describe("UUID.compare()", () => {
	it("returns 0 for equal UUIDs", () => {
		expect(UUID.compare(UUID.nil, UUID.nil)).toBe(0);
	});

	it("returns -1 when a < b", () => {
		expect(UUID.compare(UUID.nil, UUID.max)).toBe(-1);
	});

	it("returns 1 when a > b", () => {
		expect(UUID.compare(UUID.max, UUID.nil)).toBe(1);
	});
});

// --- Generation ---

describe("UUID.v4()", () => {
	it("has version 4", () => {
		expect(UUID.v4().version).toBe(Version.V4);
	});

	it("has RFC9562 variant", () => {
		expect(UUID.v4().variant).toBe(Variant.RFC9562);
	});

	it("is not nil", () => {
		expect(UUID.v4().isNil).toBe(false);
	});

	it("produces unique UUIDs", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const s = UUID.v4().toString();
			expect(seen.has(s)).toBe(false);
			seen.add(s);
		}
	});
});

describe("UUID.v5()", () => {
	it("matches RFC 9562 Appendix B.2 test vector", async () => {
		const u = await UUID.v5(UUID.namespaceDNS, "www.example.com");
		expect(u.toString()).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
	});

	it("has version 5", async () => {
		expect((await UUID.v5(UUID.namespaceDNS, "test")).version).toBe(Version.V5);
	});

	it("has RFC9562 variant", async () => {
		expect((await UUID.v5(UUID.namespaceDNS, "test")).variant).toBe(
			Variant.RFC9562,
		);
	});

	it("is deterministic", async () => {
		const a = await UUID.v5(UUID.namespaceURL, "https://example.com");
		const b = await UUID.v5(UUID.namespaceURL, "https://example.com");
		expect(a.equals(b)).toBe(true);
	});

	it("works with custom namespace", async () => {
		const ns = UUID.parse("12345678-1234-1234-1234-123456789abc");
		const u = await UUID.v5(ns, "hello");
		expect(u.version).toBe(Version.V5);
		expect(u.variant).toBe(Variant.RFC9562);
		expect(u.equals(await UUID.v5(ns, "hello"))).toBe(true);
	});

	it("works with all standard namespaces", async () => {
		for (const ns of [
			UUID.namespaceDNS,
			UUID.namespaceURL,
			UUID.namespaceOID,
			UUID.namespaceX500,
		]) {
			const u = await UUID.v5(ns, "test");
			expect(u.version).toBe(Version.V5);
			expect(u.variant).toBe(Variant.RFC9562);
		}
	});
});

describe("UUID.v7()", () => {
	it("has version 7", () => {
		expect(UUID.v7().version).toBe(Version.V7);
	});

	it("has RFC9562 variant", () => {
		expect(UUID.v7().variant).toBe(Variant.RFC9562);
	});

	it("produces unique UUIDs", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const s = UUID.v7().toString();
			expect(seen.has(s)).toBe(false);
			seen.add(s);
		}
	});

	it("extracts a reasonable timestamp", () => {
		const before = Date.now();
		const u = UUID.v7();
		const after = Date.now();
		const ts = u.time().getTime();
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after + 1);
	});
});

describe("UUID.v8()", () => {
	it("has version 8", () => {
		const data = new Uint8Array(16);
		for (let i = 0; i < 16; i++) data[i] = i;
		expect(UUID.v8(data).version).toBe(Version.V8);
	});

	it("has RFC9562 variant", () => {
		const data = new Uint8Array(16);
		expect(UUID.v8(data).variant).toBe(Variant.RFC9562);
	});

	it("preserves non-version/variant bits", () => {
		const data = new Uint8Array(16);
		for (let i = 0; i < 16; i++) data[i] = i;
		const b = UUID.v8(data).bytes();
		expect(b[0]).toBe(0x00);
		expect(b[1]).toBe(0x01);
		expect(b[2]).toBe(0x02);
		expect(b[3]).toBe(0x03);
	});

	it("is deterministic", () => {
		const data = new Uint8Array(16);
		data[0] = 0xab;
		expect(UUID.v8(data).equals(UUID.v8(data))).toBe(true);
	});

	it("throws for wrong length", () => {
		expect(() => UUID.v8(new Uint8Array(10))).toThrow();
	});
});

// --- Parsing ---

describe("UUID.parse()", () => {
	const cases = [
		{
			input: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			want: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		},
		{
			input: "00000000-0000-0000-0000-000000000000",
			want: "00000000-0000-0000-0000-000000000000",
		},
		{
			input: "ffffffff-ffff-ffff-ffff-ffffffffffff",
			want: "ffffffff-ffff-ffff-ffff-ffffffffffff",
		},
		{
			input: "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF",
			want: "ffffffff-ffff-ffff-ffff-ffffffffffff",
		},
		{
			input: "550e8400-e29b-41d4-a716-446655440000",
			want: "550e8400-e29b-41d4-a716-446655440000",
		},
	];

	for (const { input, want } of cases) {
		it(`parses ${input}`, () => {
			expect(UUID.parse(input).toString()).toBe(want);
		});
	}
});

describe("UUID.parse() errors", () => {
	const cases = [
		{ input: "", desc: "empty" },
		{ input: "6ba7b810-9dad-11d1-80b4-00c04fd430c", desc: "too short" },
		{ input: "6ba7b810-9dad-11d1-80b4-00c04fd430c8a", desc: "too long" },
		{
			input: "6ba7b810+9dad-11d1-80b4-00c04fd430c8",
			desc: "wrong separator",
		},
		{ input: "6ba7b810-9dad-11d1-80b4-00c04fd430cg", desc: "invalid hex" },
		{
			input: "urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			desc: "URN not accepted",
		},
		{
			input: "{6ba7b810-9dad-11d1-80b4-00c04fd430c8}",
			desc: "braced not accepted",
		},
		{
			input: "6ba7b8109dad11d180b400c04fd430c8",
			desc: "compact not accepted",
		},
	];

	for (const { input, desc } of cases) {
		it(`rejects ${desc}`, () => {
			expect(() => UUID.parse(input)).toThrow(ParseError);
		});
	}
});

describe("ParseError", () => {
	it("contains the input", () => {
		try {
			UUID.parse("not-a-uuid");
		} catch (e) {
			expect(e).toBeInstanceOf(ParseError);
			expect((e as ParseError).input).toBe("not-a-uuid");
		}
	});

	it("has a descriptive message", () => {
		try {
			UUID.parse("bad");
		} catch (e) {
			expect((e as Error).message).toContain("bad");
		}
	});
});

describe("UUID.parseLenient()", () => {
	const want = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

	const cases = [
		{ name: "standard", input: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" },
		{
			name: "URN",
			input: "urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		},
		{ name: "braced", input: "{6ba7b810-9dad-11d1-80b4-00c04fd430c8}" },
		{ name: "compact", input: "6ba7b8109dad11d180b400c04fd430c8" },
		{ name: "compact upper", input: "6BA7B8109DAD11D180B400C04FD430C8" },
	];

	for (const { name, input } of cases) {
		it(`parses ${name}`, () => {
			expect(UUID.parseLenient(input).toString()).toBe(want);
		});
	}
});

describe("UUID.parseLenient() errors", () => {
	const cases = [
		{ input: "", desc: "empty" },
		{ input: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", desc: "invalid hex" },
		{
			input: "6ba7b810+9dad+11d1+80b4+00c04fd430c8",
			desc: "bad hyphens",
		},
		{
			input: "abc:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			desc: "wrong URN prefix",
		},
		{
			input: "[6ba7b810-9dad-11d1-80b4-00c04fd430c8]",
			desc: "wrong braces",
		},
		{
			input: "6ba7b8109dad11d180b400c04fd430cg",
			desc: "invalid hex compact",
		},
		{
			input: "6ba7b810-9dad-11d1-80b4-00c04fd430c8-extra",
			desc: "too long",
		},
		{ input: "short", desc: "too short" },
	];

	for (const { input, desc } of cases) {
		it(`rejects ${desc}`, () => {
			expect(() => UUID.parseLenient(input)).toThrow();
		});
	}

	it("rejects URN with bad hyphens", () => {
		expect(() =>
			UUID.parseLenient("urn:uuid:6ba7b810+9dad-11d1-80b4-00c04fd430c8"),
		).toThrow();
	});

	it("rejects braced with bad hyphens", () => {
		expect(() =>
			UUID.parseLenient("{6ba7b810+9dad-11d1-80b4-00c04fd430c8}"),
		).toThrow();
	});
});

describe("UUID.fromBytes()", () => {
	it("creates UUID from bytes", () => {
		const original = UUID.parse("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
		const u = UUID.fromBytes(original.bytes());
		expect(u.equals(original)).toBe(true);
	});

	it("makes a defensive copy", () => {
		const b = new Uint8Array(16);
		const u = UUID.fromBytes(b);
		b[0] = 0xff;
		expect(u.bytes()[0]).toBe(0);
	});

	it("throws for wrong length", () => {
		expect(() => UUID.fromBytes(new Uint8Array(3))).toThrow(LengthError);
	});
});

describe("LengthError", () => {
	it("contains the actual length", () => {
		try {
			UUID.fromBytes(new Uint8Array(2));
		} catch (e) {
			expect(e).toBeInstanceOf(LengthError);
			expect((e as LengthError).got).toBe(2);
			expect((e as Error).message).toContain("2");
		}
	});
});

describe("parse round-trip", () => {
	const inputs = [
		"00000000-0000-0000-0000-000000000000",
		"ffffffff-ffff-ffff-ffff-ffffffffffff",
		"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		"550e8400-e29b-41d4-a716-446655440000",
	];

	for (const s of inputs) {
		it(`round-trips ${s}`, () => {
			expect(UUID.parse(s).toString()).toBe(s);
		});
	}
});
