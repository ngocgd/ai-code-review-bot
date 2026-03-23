import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';

// Match the Prisma enum
enum ReviewStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class UpdateReviewDto {
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsInt()
  tokensUsed?: number;

  @IsOptional()
  @IsString()
  modelUsed?: string;

  @IsOptional()
  @IsInt()
  processingMs?: number;
}
