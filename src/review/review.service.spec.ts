import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReviewService } from './review.service';
import { PrismaService } from '../database/prisma.service';

describe('ReviewService', () => {
  let service: ReviewService;

  const mockReview = {
    id: 'review-123',
    repositoryId: 'repo-123',
    prNumber: 42,
    prTitle: 'feat: add user auth',
    prAuthor: 'ngocgd',
    commitSha: 'abc123',
    status: 'PENDING',
    summary: null,
    tokensUsed: 0,
    modelUsed: null,
    processingMs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockComment = {
    id: 'comment-1',
    reviewId: 'review-123',
    filePath: 'src/auth.ts',
    line: 42,
    severity: 'WARNING',
    category: 'security',
    body: 'Missing input validation',
    postedToGh: false,
    createdAt: new Date(),
  };

  const mockPrisma = {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── CREATE ──
  describe('create', () => {
    it('should create a review', async () => {
      mockPrisma.review.create.mockResolvedValue(mockReview);

      const dto = {
        repositoryId: 'repo-123',
        prNumber: 42,
        prTitle: 'feat: add user auth',
        prAuthor: 'ngocgd',
        commitSha: 'abc123',
      };
      const result = await service.create(dto);

      expect(result).toEqual(mockReview);
      expect(mockPrisma.review.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  // ── FIND ALL with filters ──
  describe('findAll', () => {
    it('should return all reviews', async () => {
      mockPrisma.review.findMany.mockResolvedValue([mockReview]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);

      await service.findAll({ status: 'COMPLETED' as any });

      // Verify filter applied
      const call = mockPrisma.review.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('COMPLETED');
    });

    it('should filter by repositoryId', async () => {
      mockPrisma.review.findMany.mockResolvedValue([]);

      await service.findAll({ repositoryId: 'repo-123' });

      const call = mockPrisma.review.findMany.mock.calls[0][0];
      expect(call.where.repositoryId).toBe('repo-123');
    });
  });

  // ── FIND BY ID ──
  describe('findById', () => {
    it('should return review with comments', async () => {
      mockPrisma.review.findUnique.mockResolvedValue({
        ...mockReview,
        comments: [mockComment],
        repository: { id: 'repo-123', fullName: 'ngocgd/test' },
      });

      const result = await service.findById('review-123');

      expect(result.id).toBe('review-123');
      // Verify include relations
      expect(mockPrisma.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review-123' },
        include: {
          repository: true,
          comments: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    it('should throw NotFoundException', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(service.findById('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── UPDATE ──
  describe('update', () => {
    it('should update review status', async () => {
      const updated = { ...mockReview, status: 'COMPLETED', summary: 'LGTM' };
      mockPrisma.review.findUnique.mockResolvedValue(mockReview);
      mockPrisma.review.update.mockResolvedValue(updated);

      const result = await service.update('review-123', {
        status: 'COMPLETED' as any,
        summary: 'LGTM',
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.summary).toBe('LGTM');
    });
  });

  // ── COMMENTS ──
  describe('createComment', () => {
    it('should create a review comment', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(mockReview);
      mockPrisma.reviewComment.create.mockResolvedValue(mockComment);

      const result = await service.createComment({
        reviewId: 'review-123',
        filePath: 'src/auth.ts',
        line: 42,
        severity: 'WARNING' as any,
        category: 'security',
        body: 'Missing input validation',
      });

      expect(result.filePath).toBe('src/auth.ts');
      expect(result.severity).toBe('WARNING');
    });

    it('should throw if review not found', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.createComment({
          reviewId: 'nope',
          filePath: 'test.ts',
          severity: 'INFO' as any,
          category: 'style',
          body: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── STATS ──
  describe('getStats', () => {
    it('should return aggregated stats', async () => {
      mockPrisma.review.count.mockResolvedValue(10);
      mockPrisma.review.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: 8 },
        { status: 'PENDING', _count: 2 },
      ]);
      mockPrisma.review.findMany.mockResolvedValue([mockReview]);

      const result = await service.getStats();

      expect(result.totalReviews).toBe(10);
      expect(result.byStatus.COMPLETED).toBe(8);
      expect(result.recentReviews).toHaveLength(1);
    });
  });
});
