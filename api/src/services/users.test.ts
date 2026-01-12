import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService, UsersForbiddenError } from './users.js';

const selectMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());

vi.mock('../db/index.js', () => ({
  db: {
    select: selectMock,
    update: updateMock,
  },
}));

const hashMock = vi.hoisted(() => vi.fn());
const generatePasswordMock = vi.hoisted(() => vi.fn());

vi.mock('./passwords.js', () => ({
  hashPassword: hashMock,
  generatePassword: generatePasswordMock,
}));

describe('UsersService', () => {
  const service = new UsersService();

  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
    hashMock.mockReset();
    generatePasswordMock.mockReset();
    hashMock.mockResolvedValue('argon-hash');
    generatePasswordMock.mockReturnValue('temp-pass');
  });

  it('rejects list attempts for non-admins', async () => {
    await expect(service.listUsers('member')).rejects.toBeInstanceOf(UsersForbiddenError);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('retrieves users when filters are provided', async () => {
    const orderBySpy = vi.fn().mockResolvedValue([]);
    const whereSpy = vi.fn().mockReturnValue({ orderBy: orderBySpy });
    const fromSpy = vi.fn().mockReturnValue({ where: whereSpy, orderBy: orderBySpy });
    selectMock.mockReturnValueOnce({ from: fromSpy });

    const users = await service.listUsers('admin', {
      search: 'jo',
      role: 'member',
      isActive: true,
    });

    expect(users).toEqual([]);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(whereSpy).toHaveBeenCalledTimes(1);
    expect(orderBySpy).toHaveBeenCalledTimes(1);
  });

  it('updates role and status for admins', async () => {
    const returningSpy = vi
      .fn()
      .mockResolvedValue([
        {
          userId: 'user-1',
          email: 'owner@example.com',
          name: 'Owner',
          role: 'member',
          isActive: false,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        },
      ]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    updateMock.mockReturnValueOnce({ set: setSpy });

    const result = await service.updateUser('admin', 'user-1', {
      role: 'member',
      isActive: false,
    });

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'member',
        isActive: false,
        updatedAt: expect.any(Date),
      })
    );
    expect(whereSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      userId: 'user-1',
      role: 'member',
      isActive: false,
    });
  });

  it('prevents updates from non-admins', async () => {
    await expect(
      service.updateUser('member', 'user-1', { role: 'admin' })
    ).rejects.toBeInstanceOf(UsersForbiddenError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('resets passwords and returns a temporary credential', async () => {
    const returningSpy = vi.fn().mockResolvedValue([{ userId: 'user-2' }]);
    const whereSpy = vi.fn().mockReturnValue({ returning: returningSpy });
    const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
    updateMock.mockReturnValueOnce({ set: setSpy });

    const result = await service.resetPassword('admin', 'user-2');

    expect(hashMock).toHaveBeenCalledWith(expect.any(String));
    expect(result).toEqual({ userId: 'user-2', temporaryPassword: expect.any(String) });
  });

  it('rejects password resets from non-admins', async () => {
    await expect(service.resetPassword('member', 'user-2')).rejects.toBeInstanceOf(
      UsersForbiddenError
    );
    expect(updateMock).not.toHaveBeenCalled();
  });
});
