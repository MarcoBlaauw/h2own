import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.js';
import type { LoginData } from './auth.js';

const selectMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());

vi.mock('../db/index.js', () => ({
  db: {
    select: selectMock,
    update: updateMock,
    insert: insertMock,
  },
}));

vi.mock('argon2', async () => {
  const actual = await vi.importActual<typeof import('argon2')>('argon2');
  return {
    ...actual,
    verify: verifyMock,
  };
});

describe('AuthService', () => {
  const service = new AuthService();

  beforeEach(() => {
    selectMock.mockReset();
    verifyMock.mockReset();
  });

  it('returns user metadata including the role when credentials are valid', async () => {
    const passwordHash = 'argon-hash';
    const login: LoginData = { email: 'admin@example.com', password: 'sup3rsecret' };
    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () =>
          Promise.resolve([
            {
              userId: 'user-123',
              email: login.email,
              name: 'Admin',
              passwordHash,
              isActive: true,
              role: 'admin',
            },
          ]),
      }),
    });
    verifyMock.mockResolvedValue(true);

    const result = await service.validateCredentials(login);

    expect(result).toEqual({
      userId: 'user-123',
      email: login.email,
      name: 'Admin',
      role: 'admin',
    });
    expect(verifyMock).toHaveBeenCalledWith(passwordHash, login.password);
  });

  it('loads the user profile with the role by id', async () => {
    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () =>
          Promise.resolve([
            {
              userId: 'user-999',
              email: 'member@example.com',
              name: 'Member',
              role: 'member',
              createdAt: new Date('2024-01-01T00:00:00.000Z'),
            },
          ]),
      }),
    });

    const user = await service.getUserById('user-999');

    expect(user).toEqual({
      userId: 'user-999',
      email: 'member@example.com',
      name: 'Member',
      role: 'member',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });
  });
});
