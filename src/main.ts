import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ENVIRONMENTS, VALID_HOSTS } from './app.environments';
import { initSwagger } from './app.swagger';
import { AppModule } from './app.module';
import { FILE_PUBLIC_ROOT } from './file-saver/locations';
import * as fs from 'fs';

async function bootstrap() {
  const httpsOptions = {
    cert: fs.readFileSync('./rsa/https/certificate.pem', 'utf8'),
    key: fs.readFileSync('./rsa/https/certificate.key', 'utf8'),
  };

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    ENVIRONMENTS.isHttps ? { httpsOptions } : {}
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );

  app.setGlobalPrefix('api');

  app.useStaticAssets(FILE_PUBLIC_ROOT, {
    prefix: '/public',
    index: false,
  });

  if (ENVIRONMENTS.showDocs) initSwagger(app);

  app.enableCors({
    origin: function (origin, callback) {
      if (!origin || VALID_HOSTS.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  });

  await app.listen(ENVIRONMENTS.port);

  Logger.log(`Iniciado en puerto ${ENVIRONMENTS.port}`);
}
bootstrap();
