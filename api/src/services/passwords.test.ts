import { describe, expect, it, vi } from 'vitest';

const hashSpy = vi.hoisted(() => vi.fn());
const verifySpy = vi.hoisted(() => vi.fn());

vi.mock('argon2', () => ({
  hash: hashSpy,
  verify: verifySpy,
}));

describe('password helpers', () => {
  it('hashes secrets using the shared argon2 options', async () => {
    hashSpy.mockResolvedValueOnce('hashed-value');

    const { hashPassword, ARGON2_OPTIONS } = await import('./passwords.js');
    const password = 'Sup3rSecret!';
    const result = await hashPassword(password);

    expect(result).toBe('hashed-value');
    expect(hashSpy).toHaveBeenCalledWith(password, ARGON2_OPTIONS);
  });

  it('verifies secrets via argon2', async () => {
    verifySpy.mockResolvedValueOnce(true);
    verifySpy.mockResolvedValueOnce(false);

    const { verifyPassword } = await import('./passwords.js');

    await expect(verifyPassword('hash', 'ok')).resolves.toBe(true);
    await expect(verifyPassword('hash', 'nope')).resolves.toBe(false);
    expect(verifySpy).toHaveBeenNthCalledWith(1, 'hash', 'ok');
    expect(verifySpy).toHaveBeenNthCalledWith(2, 'hash', 'nope');
  });
});
