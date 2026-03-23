import { IsString, IsOptional, IsInt, IsEnum } from 'class-validator';

enum Severity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

export class CreateReviewCommentDto {
  @IsString()
  reviewId: string;

  @IsString()
  filePath: string;

  @IsOptional()
  @IsInt()
  line?: number;

  @IsEnum(Severity)
  severity: Severity;

  @IsString()
  category: string;

  @IsString()
  body: string;
}
