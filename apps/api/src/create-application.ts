import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './common/configure-app';

export async function createApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  configureApp(app);
  return app;
}
