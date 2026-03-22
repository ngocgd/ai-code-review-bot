import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

// ============================================================
// DAY 1: Project Setup
// ============================================================
// TODO [Day 1]:
// 1. Install NestJS CLI: npm i -g @nestjs/cli
// 2. Init project: nest new ai-code-review-bot (hoặc dùng skeleton này)
// 3. Install deps: npm install
// 4. Run: npm run start:dev
// 5. Test: curl http://localhost:3000/health → { status: "ok" }
// ============================================================

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe - auto-validate DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      transform: true, // auto-transform types
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🤖 AI Code Review Bot running on http://localhost:${port}`);
}

bootstrap();
