import 'reflect-metadata';
import { appConfig } from './config';
import { createApplication } from './create-application';

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  await app.listen(appConfig().port);
}

void bootstrap();
