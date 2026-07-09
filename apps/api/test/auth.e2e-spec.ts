import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_EXPIRES_IN_SECONDS, AUTH_COOKIE_NAME } from '../src/auth/auth.constants';
import { PasswordService } from '../src/auth/password.service';
import { PrismaService } from '../src/prisma/prisma.service';

type AdminRecord = {
  id: number;
  username: string;
  passwordHash: string;
  passwordVersion: number;
  displayName: string;
  lastLoginAt: Date | null;
};

describe('AuthController', () => {
  let app: INestApplication;
  let admin: AdminRecord;
  let prismaMock: {
    admin: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    operationLog: {
      create: jest.Mock;
    };
    $disconnect: jest.Mock;
  };
  const passwordService = new PasswordService();

  beforeAll(async () => {
    prismaMock = {
      admin: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      operationLog: {
        create: jest.fn(),
      },
      $disconnect: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    admin = {
      id: 1,
      username: 'admin',
      passwordHash: await passwordService.createHash('admin123'),
      passwordVersion: 1,
      displayName: 'Administrator',
      lastLoginAt: null,
    };

    prismaMock.admin.findUnique.mockImplementation(({ where }: { where: { id?: number; username?: string } }) => {
      if (where.id === admin.id || where.username === admin.username) {
        return Promise.resolve({ ...admin });
      }

      return Promise.resolve(null);
    });
    prismaMock.admin.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: number };
        data: {
          lastLoginAt?: Date;
          passwordHash?: string;
          passwordVersion?: { increment: number };
        };
      }) => {
        if (where.id !== admin.id) {
          return Promise.resolve(null);
        }

        admin = {
          ...admin,
          lastLoginAt: data.lastLoginAt ?? admin.lastLoginAt,
          passwordHash: data.passwordHash ?? admin.passwordHash,
          passwordVersion: data.passwordVersion
            ? admin.passwordVersion + data.passwordVersion.increment
            : admin.passwordVersion,
        };

        return Promise.resolve({ ...admin });
      },
    );
    prismaMock.operationLog.create.mockResolvedValue({ id: 1 });
    prismaMock.operationLog.create.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with the correct username and password and writes an operation log', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '203.0.113.9')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    expect(response.body).toMatchObject({
      admin: {
        id: 1,
        username: 'admin',
        displayName: 'Administrator',
        passwordVersion: 1,
      },
      expiresInSeconds: AUTH_EXPIRES_IN_SECONDS.default,
    });
    expect(cookieHeader(response)).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(cookieHeader(response)).toContain('HttpOnly');
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminId: 1,
          action: 'LOGIN',
          ip: '203.0.113.9',
        }),
      }),
    );
  });

  it('rejects an incorrect password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' })
      .expect(401);

    expect(prismaMock.operationLog.create).not.toHaveBeenCalled();
  });

  it('uses different expirations for default login and rememberMe login', async () => {
    const defaultLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    const rememberedLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123', rememberMe: true })
      .expect(200);

    expect(defaultLogin.body.expiresInSeconds).toBe(AUTH_EXPIRES_IN_SECONDS.default);
    expect(cookieHeader(defaultLogin)).toContain(`Max-Age=${AUTH_EXPIRES_IN_SECONDS.default}`);
    expect(rememberedLogin.body.expiresInSeconds).toBe(AUTH_EXPIRES_IN_SECONDS.rememberMe);
    expect(cookieHeader(rememberedLogin)).toContain(`Max-Age=${AUTH_EXPIRES_IN_SECONDS.rememberMe}`);
  });

  it('requires a valid auth cookie for me', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', authCookie(login))
      .expect(200);

    expect(response.body).toMatchObject({
      id: 1,
      username: 'admin',
      passwordVersion: 1,
    });
  });

  it('invalidates the old password and old token after changing the password', async () => {
    const oldLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Cookie', authCookie(oldLogin))
      .set('x-forwarded-for', '198.51.100.7')
      .send({ currentPassword: 'admin123', newPassword: 'new-password-123' })
      .expect(200);

    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', authCookie(oldLogin)).expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'new-password-123' })
      .expect(200);

    expect(prismaMock.operationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminId: 1,
          action: 'CHANGE_PASSWORD',
          ip: '198.51.100.7',
        }),
      }),
    );
  });
});

function cookieHeader(response: request.Response): string {
  const setCookie = response.headers['set-cookie'];
  return Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
}

function authCookie(response: request.Response): string {
  const setCookie = response.headers['set-cookie'];
  const firstCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return firstCookie.split(';')[0];
}
