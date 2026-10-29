import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { appConfig } from '../config';
import { csrfMiddleware } from './csrf.middleware';
import { LoggingInterceptor } from './logging.interceptor';

export function configureApp(app: INestApplication): void {
  const config = appConfig();
  app.use(cookieParser());
  app.enableCors({
    origin: config.webOrigin,
    credentials: true,
  });
  app.use(csrfMiddleware);
  app.useGlobalInterceptors(new LoggingInterceptor());
}
