import { describe, expect, it } from "vitest";
import {
  createRedisSessionStore,
  type KeyValueClient,
  type SessionRecord,
} from "./session-store.js";

class MockRedisClient implements KeyValueClient {
  public store = new Map<string, string>();
  public ttls = new Map<string, number>();

  async set(key: string, value: string, ...args: any[]): Promise<"OK"> {
    this.store.set(key, value);
    if (args[0] === "EX" && typeof args[1] === "number") {
      this.ttls.set(key, args[1]);
    }
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    this.ttls.delete(key);
    return existed ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.store.has(key)) {
      this.ttls.delete(key);
      return 0;
    }
    this.ttls.set(key, seconds);
    return 1;
  }
}

describe("createRedisSessionStore", () => {
  const ttlSeconds = 60;

  it("persists and retrieves session payloads", async () => {
    const client = new MockRedisClient();
    const store = createRedisSessionStore(client, { ttlSeconds });
    const record: SessionRecord = {
      userId: "user-1",
      role: "admin",
      expiresAt: 12345,
    };

    await store.save("sid-1", record);
    const result = await store.find("sid-1");

    expect(result).toEqual(record);
    expect(client.ttls.get("session:sid-1")).toBe(ttlSeconds);
  });

  it("returns null for missing sessions", async () => {
    const client = new MockRedisClient();
    const store = createRedisSessionStore(client, { ttlSeconds });

    const result = await store.find("missing");
    expect(result).toBeNull();
  });

  it("removes corrupted payloads when encountered", async () => {
    const client = new MockRedisClient();
    client.store.set("session:broken", "{");
    const store = createRedisSessionStore(client, { ttlSeconds });

    const result = await store.find("broken");
    expect(result).toBeNull();
    expect(client.store.has("session:broken")).toBe(false);
  });

  it("refreshes expiration without overwriting the payload", async () => {
    const client = new MockRedisClient();
    const store = createRedisSessionStore(client, { ttlSeconds });
    const record: SessionRecord = {
      userId: "u-2",
      role: null,
      expiresAt: 9876,
    };

    await store.save("sid-2", record);
    client.ttls.set("session:sid-2", 5);

    await store.touch("sid-2");
    expect(client.ttls.get("session:sid-2")).toBe(ttlSeconds);
    expect(await store.find("sid-2")).toEqual(record);
  });

  it("allows deletion of stored sessions", async () => {
    const client = new MockRedisClient();
    const store = createRedisSessionStore(client, { ttlSeconds });
    const record: SessionRecord = {
      userId: "u-3",
      role: "member",
      expiresAt: 5555,
    };

    await store.save("sid-3", record);
    await store.delete("sid-3");

    expect(await store.find("sid-3")).toBeNull();
    expect(client.ttls.has("session:sid-3")).toBe(false);
  });
});
