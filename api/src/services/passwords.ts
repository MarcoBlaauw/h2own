import { randomBytes } from 'crypto';
import { hash, verify } from 'argon2';

export const ARGON2_OPTIONS = {
  type: 2, // argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string) {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}

export function generatePassword() {
  return randomBytes(12).toString('base64url').slice(0, 18);
}
