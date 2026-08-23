import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AUTH_COOKIE_NAME } from './auth/auth.constants';
import { corsAllowedOrigins, isProduction, validateEnvironment } from './config/env';
import { uploadRoot } from './uploads/upload.service';

async function bootstrap() {
  // 先校验配置：生产环境缺失或仍是占位值的密钥必须让启动失败。
  validateEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = Number(process.env.API_PORT ?? 3000);
  const uploadPrefix = publicUploadPrefix();

  app.setGlobalPrefix('api');
  app.useStaticAssets(uploadRoot(), {
    prefix: `${uploadPrefix}/`,
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

  // Swagger 会把全部端点、参数结构和管理端接口列成一张地图。生产环境不挂，
  // 避免给扫描者省侦察功夫。开发环境照旧可用。
  if (!isProduction()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Yuer API')
      .setDescription('Engineering foundation API documentation')
      .setVersion('0.1.0')
      .addCookieAuth(AUTH_COOKIE_NAME)
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  serveWebApp(app, uploadPrefix);

  await app.listen(port);
}

/**
 * 把前台构建产物挂到 `/`，让 API 单进程同时充当站点服务器。
 *
 * 这样部署只需暴露一个端口：前台和 `/api` 天然同源，前端写死的 `/api` 前缀
 * （`apps/web/src/services/api.ts`）不用改，也不需要配 CORS 和额外的反向代理。
 *
 * 找不到产物时什么都不做 —— 本地开发前端走 Vite dev server（5173），
 * `apps/web/dist` 不存在，此时静默跳过而不是让 API 启动失败。
 */
function serveWebApp(app: NestExpressApplication, uploadPrefix: string): void {
  const webRoot = webDistRoot();

  if (!existsSync(join(webRoot, 'index.html'))) {
    return;
  }

  app.useStaticAssets(webRoot);

  const indexFile = join(webRoot, 'index.html');

  // SPA fallback：前端用 createWebHistory（`apps/web/src/router.ts`），
  // 访客直接打开 /essays/xxx 或在详情页刷新时，磁盘上并没有这个文件，
  // 不兜底就是 404。
  //
  // ⚠️ 这里必须自己判断路径前缀，不能依赖「中间件注册在 Nest 路由之后」：
  // Nest 的路由是在 app.listen() 内部才注册的，此处 app.use() 会排在它前面，
  // 一个无条件的 catch-all 会把 /api 请求也吞掉。
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (!isSpaNavigation(request, uploadPrefix)) {
      next();
      return;
    }

    response.sendFile(indexFile, (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

/** 该请求是否应当由 SPA 的 index.html 兜底。 */
function isSpaNavigation(request: Request, uploadPrefix: string): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return false;
  }

  const path = request.path;
  if (path.startsWith('/api') || path.startsWith(`${uploadPrefix}/`) || path === uploadPrefix) {
    return false;
  }

  // 只兜底页面导航。缺失的 .js / .css / 图片必须照常 404：
  //
  // ⚠️ 不能用 `request.accepts('html')` 来区分 —— 浏览器请求脚本和图片时
  // Accept 常常是 `*/*`，而 `accepts('html')` 对 `*/*` 同样返回 'html'，
  // 于是每个 404 资源都会拿到 200 + index.html。这在部署后资源哈希变化时
  // 尤其难查：旧页面请求已删除的 index-<hash>.js，拿到一坨 HTML，
  // 浏览器只报一句 `Unexpected token '<'`。
  //
  // 路由路径不带扩展名（`apps/web/src/router.ts` 里全是 /essays/:idOrSlug 这类），
  // 所以「最后一段是否含点」足以区分导航和静态资源。
  return !hasFileExtension(path);
}

/** 路径最后一段是否带扩展名，如 /assets/index-abc.js。 */
function hasFileExtension(path: string): boolean {
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);

  return lastSegment.includes('.');
}

function webDistRoot(): string {
  // 默认值相对 process.cwd()，与 uploadRoot() 保持一致的解析方式。
  // `pnpm --filter @yuer/api start` 的 cwd 是 apps/api，故前台产物在 ../web/dist。
  const configured = process.env.WEB_DIST_DIR?.trim() || join('..', 'web', 'dist');

  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

function publicUploadPrefix(): string {
  return (process.env.PUBLIC_UPLOAD_BASE_URL?.trim() || '/uploads').replace(/\/+$/, '');
}

void bootstrap();
