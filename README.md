# uuid-ts

[![CI](https://github.com/pscheid92/uuid-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/pscheid92/uuid-ts/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@pscheid92/uuid)](https://www.npmjs.com/package/@pscheid92/uuid)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

RFC 9562 UUID generation and parsing for TypeScript. Zero dependencies, browser-compatible.

Supports **V4** (random), **V5** (SHA-1 name-based), **V7** (timestamp-ordered), and **V8** (custom data).

## Install

```
npm install @pscheid92/uuid
```

## Usage

```ts
import { UUID, Generator } from "@pscheid92/uuid";

const random = UUID.v4();
const named  = await UUID.v5(UUID.namespaceDNS, "example.com");
const timed  = UUID.v7();
const custom = UUID.v8(myData);
const parsed = UUID.parse("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
```

```ts
// Inspect
timed.version;    // Version.V7
timed.variant;    // Variant.RFC9562
timed.time();     // Date (V7 only)
timed.toString(); // "019078e5-e8a4-7b9c-a..."
timed.toJSON();   // same — works with JSON.stringify
timed.toURN();    // "urn:uuid:019078e5-..."
timed.bytes();    // Uint8Array(16)
timed.isNil;      // false
timed.equals(other);
```

```ts
// Compare / sort
UUID.compare(a, b); // -1, 0, or 1
uuids.sort(UUID.compare);
```

```ts
// Lenient parsing (URN, braced, compact)
UUID.parseLenient("urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8");
UUID.parseLenient("{6ba7b810-9dad-11d1-80b4-00c04fd430c8}");
UUID.parseLenient("6ba7b8109dad11d180b400c04fd430c8");
```

```ts
// Constants
UUID.nil;           // 00000000-0000-0000-0000-000000000000
UUID.max;           // ffffffff-ffff-ffff-ffff-ffffffffffff
UUID.namespaceDNS;  // 6ba7b810-9dad-11d1-80b4-00c04fd430c8
UUID.namespaceURL;
UUID.namespaceOID;
UUID.namespaceX500;
```

```ts
// Isolated monotonicity for V7
const gen = new Generator();
gen.v7(); // independent counter from UUID.v7()
```

## V7 Implementation

`UUID.v7()` implements **RFC 9562 Section 6.2 Method 3** for sub-millisecond precision:

- 48-bit Unix millisecond timestamp
- 12-bit sub-millisecond fraction in `rand_a` (derived from `performance.now()`)
- Monotonic counter guarantees strict ordering within the same millisecond
- 62 bits of `crypto.getRandomValues()` randomness in `rand_b`

Use `Generator` when you need isolated monotonicity (e.g., per-request or per-connection counters).

## Why this library?

| Feature                    | **@pscheid92/uuid** | **[uuid](https://github.com/uuidjs/uuid)** | **[uuidv7](https://github.com/LiosK/uuidv7)** |
|----------------------------|-------------|--------------------------------------------|-----------------------------------------------|
| RFC 9562                   | Yes         | Yes                                        | Yes                                           |
| V4 (random)                | Yes         | Yes                                        | No                                            |
| V5 (name-based)            | Yes         | Yes                                        | No                                            |
| V7 (timestamp)             | Yes         | Yes                                        | Yes                                           |
| V7 Method 3 (sub-ms)       | Yes         | No                                         | No (counter-based)                            |
| V8 (custom)                | Yes         | No                                         | No                                            |
| Browser-native             | Yes         | Yes                                        | Yes                                           |
| Zero dependencies          | Yes         | Yes                                        | Yes                                           |
| TypeScript-first           | Yes         | Yes (since v10)                            | Yes                                           |
| Class-based API            | Yes         | No (functions)                             | No (functions)                                |
| Legacy versions (V1/V3/V6) | No          | Yes                                        | No                                            |

**Pick @pscheid92/uuid if:**

- You want the RFC-recommended versions (V4, V5, V7, V8) without legacy baggage
- You want V7 with sub-millisecond precision per RFC 9562 Method 3
- You prefer a class-based API where everything hangs off `UUID.*`
- You want a small, focused library with 100% test coverage

**Pick [uuid](https://www.npmjs.com/package/uuid) if:**

- You need V1, V3, or V6 for backward compatibility
- You want the most battle-tested option (100M+ weekly downloads)

## API

### Generation

| Method                     | Returns         | Description                                       |
|----------------------------|-----------------|---------------------------------------------------|
| `UUID.v4()`                | `UUID`          | Random UUID                                       |
| `UUID.v5(namespace, name)` | `Promise<UUID>` | Deterministic SHA-1 (async, uses Web Crypto)      |
| `UUID.v7()`                | `UUID`          | Timestamp + random, module-level monotonicity     |
| `UUID.v8(data)`            | `UUID`          | Custom 16-byte data with version/variant bits set |
| `new Generator().v7()`     | `UUID`          | V7 with per-instance monotonicity                 |

### Parsing

| Method                  | Returns | Description                                |
|-------------------------|---------|--------------------------------------------|
| `UUID.parse(s)`         | `UUID`  | Strict 36-char hyphenated form             |
| `UUID.parseLenient(s)`  | `UUID`  | Standard, URN, braced, or compact (32-hex) |
| `UUID.fromBytes(bytes)` | `UUID`  | From 16-byte Uint8Array                    |

### Errors

- `ParseError` — thrown by `parse()` / `parseLenient()` (has `.input` and `.msg`)
- `LengthError` — thrown by `fromBytes()` / `v8()` for wrong length (has `.got` and `.want`)

## License

MIT
