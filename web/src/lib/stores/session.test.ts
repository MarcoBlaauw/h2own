import { get } from "svelte/store";
import { describe, expect, it } from "vitest";
import { user } from "./session.js";

describe("user session store", () => {
  it("allows writing and clearing the active user", () => {
    const initial = get(user);
    expect(initial).toBeNull();

    const unsubscribe = user.subscribe(() => {});
    const profile = { id: "abc123", email: "user@example.com" };

    user.set(profile);
    expect(get(user)).toEqual(profile);

    user.set(null);
    expect(get(user)).toBeNull();

    unsubscribe();
  });
});
