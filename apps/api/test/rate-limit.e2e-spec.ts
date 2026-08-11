import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * 通过真实 HTTP 请求验证限流生效。
 *
 * 单元测试直接 new 出 guard，无法证明 Nest 在多次请求之间复用同一个实例；
 * 一旦 guard 变成 request-scoped，计数器每次都会重置，限流会静默失效。
 */
describe('RateLimitGuard (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const prismaMock = {
      admin: { findUnique: jest.fn().mockResolvedValue(null) },
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

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 once the login attempt limit is exceeded', async () => {
    const server = app.getHttpServer();
    const attempt = () =>
      request(server)
        .post('/api/auth/login')
        .set('x-forwarded-for', '198.51.100.7')
        .send({ username: 'admin', password: 'wrong-password' });

    const statuses: number[] = [];
    // 阈值是 10 次/5 分钟，第 11 次必须被拒。
    for (let index = 0; index < 11; index += 1) {
      const response = await attempt();
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);

    const blocked = statuses[10];
    expect(blocked).toBe(429);
  });

  it('tracks limits per client address', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '198.51.100.99')
      .send({ username: 'admin', password: 'wrong-password' });

    // 换一个 IP 后仍在阈值内，不应被上一个 IP 的计数波及。
    expect(response.status).toBe(401);
  });
});
