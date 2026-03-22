import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// ============================================================
// DAY 2: Database Setup
// ============================================================
// TODO [Day 2]:
// 1. docker-compose up -d (start PostgreSQL + Redis)
// 2. npm install prisma @prisma/client
// 3. npx prisma migrate dev --name init
// 4. npx prisma studio (xem DB trong browser)
// 5. Write PrismaService (see below)
// 6. Test: inject PrismaService vào HealthController, check DB connection
//
// Learn:
// - Prisma schema syntax (models, relations, enums)
// - Migrations: how they work, up/down
// - Prisma Client: findMany, create, update, delete
// - Connection pooling in production
// ============================================================

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
