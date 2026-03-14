import { describe, expect, it } from "vitest";
import { Generator } from "./generate.js";
import { UUID } from "./uuid.js";

describe("Generator", () => {
	it("produces monotonically increasing UUIDs", () => {
		const gen = new Generator();
		let prev = gen.v7();
		for (let i = 0; i < 100; i++) {
			const curr = gen.v7();
			expect(UUID.compare(curr, prev)).toBeGreaterThan(0);
			prev = curr;
		}
	});

	it("produces sortable UUIDs", () => {
		const gen = new Generator();
		const uuids = Array.from({ length: 100 }, () => gen.v7());
		const sorted = [...uuids].sort(UUID.compare);
		for (let i = 0; i < uuids.length; i++) {
			expect(uuids[i].equals(sorted[i])).toBe(true);
		}
	});

	it("independent generators produce different UUIDs", () => {
		const gen1 = new Generator();
		const gen2 = new Generator();
		const u1 = gen1.v7();
		const u2 = gen2.v7();
		expect(u1.equals(u2)).toBe(false);
	});
});
