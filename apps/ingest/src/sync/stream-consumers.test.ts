import { describe, expect, test } from "bun:test"

import { getField, parseAutoClaimResponse, parseReadGroupResponse } from "./stream-consumers"

// Replies captured from Redis 8 through ioredis 6, which negotiates RESP3 unless `protocol: 2` is set.
const entriesA = [
  ["1791574045315-0", ["payload", "a1"]],
  ["1791574045315-1", ["payload", "a2"]],
]
const entriesB = [["1791574045316-0", ["payload", "b1"]]]

const payloads = (messages: ReturnType<typeof parseReadGroupResponse>) =>
  messages.map((message) => getField(message.fields, "payload"))

describe("parseReadGroupResponse", () => {
  test("reads RESP2 replies: one [stream, entries] pair per stream", () => {
    const reply = [
      ["stream:a", entriesA],
      ["stream:b", entriesB],
    ]
    expect(payloads(parseReadGroupResponse(reply))).toEqual(["a1", "a2", "b1"])
  })

  test("reads RESP3 replies: a map flattened to [stream, entries, stream, entries]", () => {
    const reply = ["stream:a", entriesA, "stream:b", entriesB]
    expect(payloads(parseReadGroupResponse(reply))).toEqual(["a1", "a2", "b1"])
  })

  test("keeps the entry ids", () => {
    expect(parseReadGroupResponse(["stream:a", entriesA]).map((message) => message.id)).toEqual([
      "1791574045315-0",
      "1791574045315-1",
    ])
  })

  test("returns nothing when the blocking read times out", () => {
    expect(parseReadGroupResponse(null)).toEqual([])
  })

  test("skips malformed entries", () => {
    const reply = [
      "stream:a",
      [["1791574045315-0", ["payload", "a1"]], ["1791574045315-1"], "not-an-entry"],
    ]
    expect(payloads(parseReadGroupResponse(reply))).toEqual(["a1"])
  })
})

describe("parseAutoClaimResponse", () => {
  test("reads [nextCursor, entries, deletedIds], the same under RESP2 and RESP3", () => {
    expect(payloads(parseAutoClaimResponse(["0-0", entriesA, []]))).toEqual(["a1", "a2"])
  })

  test("returns nothing for an unexpected reply", () => {
    expect(parseAutoClaimResponse(null)).toEqual([])
  })
})
