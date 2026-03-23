import { PrismaService } from "@/database/prisma.service";
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  constructor(private prisma: PrismaService) {}
  @Get()
  async check() {
    let dbStatus = "disconnected";
    try {
      await this.prisma.$queryRaw`Select 1`;
      dbStatus = "connected";
    } catch (e) {
      dbStatus = "error";
    }
    return {
      status: "ok",
      dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
