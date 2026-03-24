import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RepositoryService } from './repository.service';
import { PrismaService } from '../database/prisma.service';

describe('RepositoryService', () => {
  let service: RepositoryService;

  // ── Mock Data ──
  // Dùng để test mà không cần DB thật
  const mockRepo = {
    id: 'repo-123',
    owner: 'ngocgd',
    name: 'test-repo',
    fullName: 'ngocgd/test-repo',
    installId: null,
    isActive: true,
    config: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ── Mock Prisma ──
  // Giả lập toàn bộ Prisma Client methods
  const mockPrisma = {
    repository: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RepositoryService>(RepositoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── CREATE ──
  describe('create', () => {
    it('should create a repository with fullName', async () => {
      // Arrange
      const dto = { owner: 'ngocgd', name: 'test-repo' };
      mockPrisma.repository.create.mockResolvedValue(mockRepo);

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).toEqual(mockRepo);
      // Kiểm tra Prisma được gọi với đúng data
      expect(mockPrisma.repository.create).toHaveBeenCalledWith({
        data: { ...dto, fullName: 'ngocgd/test-repo' },
      });
    });
  });

  // ── FIND ALL ──
  describe('findAll', () => {
    it('should return active repositories by default', async () => {
      mockPrisma.repository.findMany.mockResolvedValue([mockRepo]);

      const result = await service.findAll();

      expect(result).toEqual([mockRepo]);
      // Verify: filter isActive = true
      expect(mockPrisma.repository.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return all repositories when activeOnly = false', async () => {
      mockPrisma.repository.findMany.mockResolvedValue([mockRepo]);

      await service.findAll(false);

      // Verify: where = undefined (no filter)
      expect(mockPrisma.repository.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ── FIND BY ID ──
  describe('findById', () => {
    it('should return repository when found', async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepo);

      const result = await service.findById('repo-123');

      expect(result).toEqual(mockRepo);
      expect(mockPrisma.repository.findUnique).toHaveBeenCalledWith({
        where: { id: 'repo-123' },
        include: { reviews: { take: 10, orderBy: { createdAt: 'desc' } } },
      });
    });

    // ⭐ Test quan trọng: error handling
    it('should throw NotFoundException when not found', async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      // expect().rejects = test async function throws
      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── UPDATE ──
  describe('update', () => {
    it('should update repository', async () => {
      const updated = { ...mockRepo, isActive: false };
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepo);
      mockPrisma.repository.update.mockResolvedValue(updated);

      const result = await service.update('repo-123', { isActive: false });

      expect(result.isActive).toBe(false);
      expect(mockPrisma.repository.update).toHaveBeenCalledWith({
        where: { id: 'repo-123' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException when updating non-existent', async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { isActive: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── REMOVE (soft delete) ──
  describe('remove', () => {
    it('should soft delete (set isActive = false)', async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepo);
      mockPrisma.repository.update.mockResolvedValue({
        ...mockRepo,
        isActive: false,
      });

      const result = await service.remove('repo-123');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.repository.update).toHaveBeenCalledWith({
        where: { id: 'repo-123' },
        data: { isActive: false },
      });
    });
  });
});
