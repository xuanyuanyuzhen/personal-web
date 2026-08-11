import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AUTH_COOKIE_NAME } from './auth/auth.constants';
import { corsAllowedOrigins, validateEnvironment } from './config/env';
import { uploadRoot } from './uploads/upload.service';

async function bootstrap() {
  // 先校验配置：生产环境缺失或仍是占位值的密钥必须让启动失败。
  validateEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = Number(process.env.API_PORT ?? 3000);

  app.setGlobalPrefix('api');
  app.useStaticAssets(uploadRoot(), {
    prefix: `${(process.env.PUBLIC_UPLOAD_BASE_URL?.trim() || '/uploads').replace(/\/+$/, '')}/`,
  });

  // 只允许白名单来源携带凭证。原来的 `origin: true` 会回显任意 Origin，
  // 等于让任何站点都能带着管理员 cookie 调接口。
  const allowedOrigins = corsAllowedOrigins();
  if (allowedOrigins.length > 0) {
    app.enableCors({
      credentials: true,
      origin: allowedOrigins,
    });
  }

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
