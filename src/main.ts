import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Global validation pipe - auto-validate DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      transform: true, // auto-transform types
    }),
  );

  const port = process.env.PORT || 3015;
  await app.listen(port);
  console.log(`🤖 AI Code Review Bot running on http://localhost:${port}`);
}

bootstrap();
