import { IsOptional, IsInt, IsBoolean } from 'class-validator';

export class UpdateRepositoryDto {
  @IsOptional()
  @IsInt()
  installId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  config?: Record<string, any>;
}
