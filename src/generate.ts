// Generator for Version 7 UUIDs with per-instance monotonicity.

import { UUID } from "./uuid.js";
import { buildV7 } from "./v7.js";

/**
 * Generator produces Version 7 UUIDs with per-instance monotonicity.
 *
 * V7 encodes a 48-bit Unix millisecond timestamp and 12 bits of
 * sub-millisecond precision in the rand_a field, computed per
 * RFC 9562 Section 6.2 Method 3. The rand_b field is random.
 *
 * For a shared default generator, use UUID.v7() instead.
 */
export class Generator {
	private lastSeq = 0;

	/** Returns a new Version 7 UUID with monotonicity guaranteed within this Generator. */
	v7(): UUID {
		const [bytes, seq] = buildV7(this.lastSeq);
		this.lastSeq = seq;
		return UUID.fromBytes(bytes);
	}
}
