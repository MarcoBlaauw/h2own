import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.js';
import type { LoginData } from './auth.js';

const selectMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());
const hashMock = vi.hoisted(() => vi.fn());

vi.mock('../db/index.js', () => ({
  db: {
    select: selectMock,
    update: updateMock,
    insert: insertMock,
    transaction: transactionMock,
  },
}));

vi.mock('./passwords.js', () => ({
  hashPassword: hashMock,
  verifyPassword: verifyMock,
}));

describe('AuthService', () => {
  const service = new AuthService();

  beforeEach(() => {
    selectMock.mockReset();
    verifyMock.mockReset();
    transactionMock.mockReset();
    hashMock.mockReset();
    hashMock.mockResolvedValue('argon-hash');
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

  it('promotes the first user to admin role', async () => {
    const returningSpy = vi.fn().mockResolvedValue([{ userId: 'user-1' }]);
    const valuesSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const insertSpy = vi.fn().mockReturnValue({ values: valuesSpy });
    const fromSpy = vi.fn().mockResolvedValue([{ count: 0 }]);
    const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });

    transactionMock.mockImplementationOnce(async (callback) => {
      return callback({
        select: selectSpy,
        insert: insertSpy,
      } as any);
    });

    const userId = await service.createUser({
      email: 'owner@example.com',
      password: 'sup3rsecret',
      name: 'Owner',
    });

    expect(userId).toBe('user-1');
    expect(hashMock).toHaveBeenCalledWith('sup3rsecret');
    expect(selectSpy).toHaveBeenCalled();
    expect(valuesSpy).toHaveBeenCalledTimes(1);
    expect(valuesSpy).toHaveBeenCalledWith({
      email: 'owner@example.com',
      passwordHash: 'argon-hash',
      name: 'Owner',
      isActive: true,
      role: 'admin',
    });
  });

  it('leaves subsequent users as members', async () => {
    const returningSpy = vi.fn().mockResolvedValue([{ userId: 'user-2' }]);
    const valuesSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const insertSpy = vi.fn().mockReturnValue({ values: valuesSpy });
    const fromSpy = vi.fn().mockResolvedValue([{ count: 1 }]);
    const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });

    transactionMock.mockImplementationOnce(async (callback) => {
      return callback({
        select: selectSpy,
        insert: insertSpy,
      } as any);
    });

    const userId = await service.createUser({
      email: 'member@example.com',
      password: 'password123',
    });

    expect(userId).toBe('user-2');
    expect(valuesSpy).toHaveBeenCalledTimes(1);
    const insertedUser = valuesSpy.mock.calls[0][0];
    expect(insertedUser).toMatchObject({
      email: 'member@example.com',
      passwordHash: 'argon-hash',
      name: null,
      isActive: true,
    });
    expect(insertedUser.role).toBeUndefined();
  });
});
