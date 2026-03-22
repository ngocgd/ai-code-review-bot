import { Controller, Get } from '@nestjs/common';

// ============================================================
// DAY 1: Health Check Endpoint
// ============================================================
// TODO [Day 1]:
// 1. Implement basic health check
// 2. Add database connection check
// 3. Add Redis connection check
// 4. Write test: health.controller.spec.ts
//
// Test: curl http://localhost:3000/health
// Expected: { status: "ok", timestamp: "...", uptime: 123 }
// ============================================================

@Controller('health')
export class HealthController {
  @Get()
  check() {
    // TODO [Day 1]: Return health status with DB & Redis checks
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
