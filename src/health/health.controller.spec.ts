import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '@/database/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: PrismaService;

  // Mock PrismaService — thay vì kết nối DB thật, ta giả lập
  const mockPrisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    // TestingModule = NestJS testing utility
    // Tạo module test với mock dependencies
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrisma, // inject mock thay vì real PrismaService
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  // Reset mock sau mỗi test — tránh state leak giữa tests
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Test 1: Basic health check ──
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── Test 2: DB connected → status ok ──
  it('should return ok when database is connected', async () => {
    // Arrange: mock DB query thành công
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    // Act: gọi controller method
    const result = await controller.check();

    // Assert: kiểm tra kết quả
    expect(result.status).toBe('ok');
    expect(result.dbStatus).toBe('connected');
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThan(0);
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });

  // ── Test 3: DB disconnected → status error ──
  it('should return error dbStatus when database fails', async () => {
    // Arrange: mock DB query throw error
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    // Act
    const result = await controller.check();

    // Assert: status vẫn ok (app chạy), nhưng DB error
    expect(result.status).toBe('ok');
    expect(result.dbStatus).toBe('error');
  });
});
