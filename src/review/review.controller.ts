import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CreateReviewCommentDto } from './dto/create-review-comment.dto';
import { ReviewStatus } from '@prisma/client';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  create(@Body() dto: CreateReviewDto) {
    return this.reviewService.create(dto);
  }

  @Get()
  findAll(
    @Query('status') status?: ReviewStatus,
    @Query('repositoryId') repositoryId?: string,
  ) {
    return this.reviewService.findAll({ status, repositoryId });
  }

  @Get('stats')
  getStats() {
    return this.reviewService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewService.update(id, dto);
  }

  // ==================== Comments ====================

  @Post(':id/comments')
  createComment(@Param('id') id: string, @Body() dto: CreateReviewCommentDto) {
    dto.reviewId = id;
    return this.reviewService.createComment(dto);
  }

  @Get(':id/comments')
  getComments(@Param('id') id: string) {
    return this.reviewService.getCommentsByReview(id);
  }
}
