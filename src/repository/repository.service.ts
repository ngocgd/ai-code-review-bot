import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';

@Injectable()
export class RepositoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRepositoryDto) {
    const fullName = `${dto.owner}/${dto.name}`;
    return this.prisma.repository.create({
      data: { ...dto, fullName },
    });
  }

  async findAll(activeOnly = true) {
    return this.prisma.repository.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const repo = await this.prisma.repository.findUnique({
      where: { id },
      include: { reviews: { take: 10, orderBy: { createdAt: 'desc' } } },
    });
    if (!repo) throw new NotFoundException(`Repository ${id} not found`);
    return repo;
  }

  async findByFullName(fullName: string) {
    return this.prisma.repository.findUnique({
      where: { fullName },
    });
  }

  async update(id: string, dto: UpdateRepositoryDto) {
    await this.findById(id); // throws if not found
    return this.prisma.repository.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    // Soft delete — set isActive = false
    return this.prisma.repository.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
