import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { PrismaService } from '../database/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const passwords = {
    hash: jest.fn().mockResolvedValue('hash'),
    verify: jest.fn(),
  };
  const sessions = {
    createSession: jest.fn().mockResolvedValue({
      token: 'session-token',
      expiresAt: new Date('2030-01-01'),
    }),
    revokeByToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('registers a new user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      email: 'a@test.com',
      displayName: 'A',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.register({
      email: 'a@test.com',
      password: 'Str0ngPass!',
      displayName: 'A',
    });

    expect(result.user.email).toBe('a@test.com');
    expect(result.sessionToken).toBe('session-token');
  });

  it('rejects duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(
      service.register({
        email: 'dup@test.com',
        password: 'Str0ngPass!',
        displayName: 'Dup',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@test.com', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      passwordHash: 'hash',
      email: 'a@test.com',
      displayName: 'A',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    passwords.verify.mockResolvedValue(false);
    await expect(
      service.login({ email: 'a@test.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
