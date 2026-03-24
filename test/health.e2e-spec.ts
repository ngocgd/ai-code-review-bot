import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/database/prisma.service';

/**
 * E2E Test = Integration Test
 * 
 * Khác với Unit Test:
 * - Unit Test: test 1 function, mock tất cả dependencies
 * - E2E Test: test toàn bộ flow HTTP request → controller → service → (mock) DB → response
 * 
 * Ở đây ta mock PrismaService để không cần DB thật,
 * nhưng test toàn bộ NestJS pipeline (middleware, pipes, controllers, services)
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    // PrismaService lifecycle methods
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    // Mock other models to prevent errors
    repository: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    review: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    reviewComment: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // overrideProvider = replace real service with mock
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /health → 200 ──
  it('/health (GET) — should return 200', () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.dbStatus).toBe('connected');
        expect(res.body.timestamp).toBeDefined();
      });
  });

  // ── GET /health with DB down → still 200 but dbStatus error ──
  it('/health (GET) — should return dbStatus error when DB fails', () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.dbStatus).toBe('error');
      });
  });
});
