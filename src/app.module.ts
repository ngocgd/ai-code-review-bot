import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { WebhookModule } from "./webhook/webhook.module";
import { ReviewModule } from "./review/review.module";
import { RepositoryModule } from "./repository/repository.module";
import { GithubModule } from "./github/github.module";
import { LlmModule } from "./llm/llm.module";
import { QueueModule } from "./queue/queue.module";
import { DatabaseModule } from "./database/database.module";

// ============================================================
// Module Registration Roadmap:
//
// Day 1-2:  HealthModule, ConfigModule, DatabaseModule
// Day 3:    RepositoryModule, ReviewModule (CRUD APIs)
// Day 5-6:  WebhookModule (receive GitHub events)
// Day 7-8:  GithubModule (interact with GitHub API)
// Day 9-11: LlmModule (AI review logic)
// Day 12:   QueueModule (async processing)
// Day 13:   Wire everything together
// ============================================================

@Module({
  imports: [
    // Load .env file
    ConfigModule.forRoot({ isGlobal: true }),

    // Core modules
    DatabaseModule,
    HealthModule,

    // Day 3: CRUD APIs
    RepositoryModule,
    ReviewModule,

    // Feature modules (uncomment as you build)
    // WebhookModule,    // Day 5-6
    // GithubModule,     // Day 7-8
    // LlmModule,        // Day 9-11
    // QueueModule,      // Day 12
  ],
})
export class AppModule {}
