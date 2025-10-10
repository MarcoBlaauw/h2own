import { writable } from "svelte/store";

export type SessionUser = {
  id: string;
  email?: string;
  name?: string;
  role?: string | null;
} | null;

export const user = writable<SessionUser>(null);
