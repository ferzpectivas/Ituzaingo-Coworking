import 'reflect-metadata';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { AppModule } from './app.module';
import { appConfig } from './config';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    trustProxy: true,
    bodyLimit: 4 * 1024 * 1024,
    logger: false,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: false,
  });

  const allowedOrigins = appConfig.webOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cookie);
  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origen no permitido'), false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key', 'x-requested-with'],
    exposedHeaders: ['content-disposition'],
    maxAge: 600,
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', async (_request, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    reply.removeHeader('x-powered-by');
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      stopAtFirstError: false,
      validationError: { target: false, value: false },
      exceptionFactory: (errors) => {
        const flatten = (
          list: typeof errors,
          parent = '',
        ): Array<{ field: string; message: string }> =>
          list.flatMap((error) => {
            const field = parent ? `${parent}.${error.property}` : error.property;
            const own = Object.values(error.constraints ?? {}).map((message) => ({
              field,
              message,
            }));
            const children = error.children?.length ? flatten(error.children, field) : [];
            return [...own, ...children];
          });
        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Revisá los datos ingresados.',
          errors: flatten(errors),
        });
      },
    }),
  );

  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Espacio de Coworking de Ituzaingó')
    .setDescription(
      'API REST para reservas, ocupación en vivo, equipamiento y reportes del Espacio de Coworking. ' +
        'Autenticación por cookies httpOnly (cw_access) con refresh rotativo (cw_refresh).',
    )
    .setVersion('1.0.0')
    .addCookieAuth('cw_access', { type: 'apiKey', in: 'cookie', name: 'cw_access' }, 'Sesión')
    .addTag('Autenticación')
    .addTag('Mapa y espacios')
    .addTag('Reservas')
    .addTag('Equipamiento')
    .addTag('Auditoría')
    .addTag('Reportes')
    .addTag('Tiempo real')
    .addServer('/api/v1')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'API Coworking Ituzaingó',
  });

  await app.listen({ port: appConfig.port, host: '0.0.0.0' });

  logger.log(`API escuchando en http://localhost:${appConfig.port}/api/v1`);
  logger.log(`Swagger disponible en http://localhost:${appConfig.port}/api/docs`);
  logger.log(`Orígenes permitidos: ${allowedOrigins.join(', ') || 'ninguno'}`);
  logger.log(`Datos JSON en ${appConfig.dataDir}`);
}

bootstrap().catch((error) => {
  logger.error(`No se pudo iniciar la API: ${(error as Error).message}`, (error as Error).stack);
  process.exit(1);
});
