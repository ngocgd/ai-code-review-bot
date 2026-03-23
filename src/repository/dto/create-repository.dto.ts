import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateRepositoryDto {
  @IsString()
  owner: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  installId?: number;

  @IsOptional()
  config?: Record<string, any>;
}
