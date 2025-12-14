import "tsconfig-paths/register";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@/app.module";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SocketIOAdapter } from "./socketio.adapter";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { REDIS_CLIENT } from "./redis/constants/redis.constants";
import { ConsoleLogger, ValidationPipe, HttpException } from "@nestjs/common";
import appConfig from "./config/app.config";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: true,
      credentials: true,
    },
    logger: new ConsoleLogger({
      prefix: appConfig.name
    }),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: false, // Don't throw error for non-whitelisted properties (just strip them)
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
      exceptionFactory: (errors) => {
        // Custom exception factory to ensure proper 400 status code
        const messages = errors.map((error) => {
          return Object.values(error.constraints || {}).join(", ");
        });
        return new HttpException(
          {
            statusCode: 400,
            message: messages.length > 0 ? messages : "Validation failed",
            error: "Bad Request",
          },
          400,
        );
      },
    }),
  );

  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  const appName = config.get<string>("app.name")!;

  // Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle(appName)
    .setDescription(`${appName} API documentation`)
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "Bearer",
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/reference", app, document);

  app.setGlobalPrefix("api");

  const socketAdapter = new SocketIOAdapter(app);
  socketAdapter.connect(app.get(REDIS_CLIENT));
  app.useWebSocketAdapter(socketAdapter);

  if (config.get<boolean>("app.debug")) {
    app.getHttpAdapter().getInstance().set("json spaces", 2);
  }

  const port = config.get<string>("app.port")!;
  await app.listen(port);
}

bootstrap();
