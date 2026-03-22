import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// ============================================================
// DAY 2: Prisma Service
// ============================================================
// TODO [Day 2]:
// 1. Extend PrismaClient
// 2. Implement onModuleInit → connect to DB
// 3. Implement onModuleDestroy → disconnect
// 4. Add logging in development mode
//
// Learn:
// - NestJS lifecycle hooks (onModuleInit, onModuleDestroy)
// - Dependency Injection pattern
// - Why we wrap PrismaClient in a service
// ============================================================

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // TODO [Day 2]: Connect to database
    // await this.$connect();
  }

  async onModuleDestroy() {
    // TODO [Day 2]: Disconnect from database
    // await this.$disconnect();
  }
}
