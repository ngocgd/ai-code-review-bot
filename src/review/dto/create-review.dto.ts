import { IsString, IsInt } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  repositoryId: string;

  @IsInt()
  prNumber: number;

  @IsString()
  prTitle: string;

  @IsString()
  prAuthor: string;

  @IsString()
  commitSha: string;
}
