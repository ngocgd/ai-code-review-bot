import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CreateReviewCommentDto } from './dto/create-review-comment.dto';
import { ReviewStatus } from '@prisma/client';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== Reviews ====================

  async create(dto: CreateReviewDto) {
    return this.prisma.review.create({ data: dto });
  }

  async findAll(filters?: { status?: ReviewStatus; repositoryId?: string }) {
    return this.prisma.review.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.repositoryId && { repositoryId: filters.repositoryId }),
      },
      include: { repository: true, _count: { select: { comments: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findById(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        repository: true,
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!review) throw new NotFoundException(`Review ${id} not found`);
    return review;
  }

  async update(id: string, dto: UpdateReviewDto) {
    await this.findById(id);
    return this.prisma.review.update({
      where: { id },
      data: dto,
    });
  }

  // ==================== Review Comments ====================

  async createComment(dto: CreateReviewCommentDto) {
    // Verify review exists
    await this.findById(dto.reviewId);
    return this.prisma.reviewComment.create({ data: dto });
  }

  async getCommentsByReview(reviewId: string) {
    return this.prisma.reviewComment.findMany({
      where: { reviewId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ==================== Stats ====================

  async getStats() {
    const [total, byStatus, recentReviews] = await Promise.all([
      this.prisma.review.count(),
      this.prisma.review.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.review.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { repository: true, _count: { select: { comments: true } } },
      }),
    ]);

    return {
      totalReviews: total,
      byStatus: Object.fromEntries(
        byStatus.map((s) => [s.status, s._count]),
      ),
      recentReviews,
    };
  }
}
