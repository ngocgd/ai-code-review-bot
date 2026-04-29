import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService, ConfigModule } from "@nestjs/config";
import { ReviewProcessor } from "@/queue/review.processor";
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get("REDIS_HOST", "localhost"),
          port: config.get<number>("REDIS_PORT", 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: "review-pr",
    }),
  ],
  providers: [ReviewProcessor],
  exports: [BullModule],
})
export class QueueModule {}
