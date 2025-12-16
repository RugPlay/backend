import {
  Module,
  ClassSerializerInterceptor,
} from "@nestjs/common";
import { ConfigModule, ConfigService, registerAs } from "@nestjs/config";
import appConfig from "@/config/app.config";
import sqlConfig from "@/config/sql.config";
import redisConfig from "@/config/redis.config";
import { SocketModule } from "@/modules/socket/socket.module";
import { ExchangeModule } from "@/modules/exchange/exchange.module";
import { AssetsModule } from "@/modules/assets/assets.module";
import { AnalyticsModule } from "@/modules/analytics/analytics.module";
import { AllExceptionFilter } from "@/filters/all-exception.filter";
import cookieConfig from "@/config/cookie.config";
import { CacheModule } from "@nestjs/cache-manager";
import { ScheduleModule } from "@nestjs/schedule";
import { KeyvAnyRedis } from "keyv-anyredis";
import { EventEmitterModule } from "@nestjs/event-emitter";
import authConfig from "@/config/auth.config";
import { JwtModule } from "@nestjs/jwt";
import Keyv from "keyv";
import { RedisModule } from "@/redis/redis.module";
import Redis from "ioredis";
import { REDIS_CLIENT } from "@/redis/constants/redis.constants";
import { DATABASE_POOL } from "./postgres/constants/postgres.constants";
import { KyselyModule } from "nestjs-kysely";
import { PostgresModule } from "./postgres/postgres.module";
import { PostgresDialect } from "kysely";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [
        registerAs('app', () => appConfig),
        registerAs('cookie', () => cookieConfig),
        registerAs('sql', () => sqlConfig), 
        registerAs('redis', () => redisConfig),
        registerAs('auth', () => authConfig),
      ],
    }),
    EventEmitterModule.forRoot(),
    RedisModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (redisClient: Redis) => {
        return {
          stores: [
            new Keyv({
              store: new KeyvAnyRedis(redisClient),
            }),
          ],
        };
      },
      inject: [REDIS_CLIENT],
      isGlobal: true,
    }),
    PostgresModule,
    ScheduleModule.forRoot(),
    KyselyModule.forRootAsync({
      imports: [PostgresModule],
      inject: [DATABASE_POOL],
      useFactory: (postgresPool: any) => ({
        dialect: new PostgresDialect({
          pool: postgresPool,
        }),
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("app.secret"),
      }),
      inject: [ConfigService],
    }),
    SocketModule,
    ExchangeModule,
    AssetsModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: "APP_FILTER",
      useClass: AllExceptionFilter,
    },
    {
      provide: "APP_INTERCEPTOR",
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class AppModule {}
