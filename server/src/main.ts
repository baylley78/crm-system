import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];

const getAllowedOrigins = () => {
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins?.length ? configuredOrigins : DEFAULT_CORS_ORIGINS;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const uploadDir = join(process.cwd(), 'uploads');

  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));

  app.enableCors({
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
