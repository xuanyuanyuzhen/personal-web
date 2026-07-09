import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AUTH_COOKIE_NAME } from './auth/auth.constants';
import { uploadRoot } from './uploads/upload.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = Number(process.env.API_PORT ?? 3000);

  app.setGlobalPrefix('api');
  app.useStaticAssets(uploadRoot(), {
    prefix: `${(process.env.PUBLIC_UPLOAD_BASE_URL?.trim() || '/uploads').replace(/\/+$/, '')}/`,
  });
  app.enableCors({
    credentials: true,
    origin: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Yuer API')
    .setDescription('Engineering foundation API documentation')
    .setVersion('0.1.0')
    .addCookieAuth(AUTH_COOKIE_NAME)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
}

void bootstrap();
