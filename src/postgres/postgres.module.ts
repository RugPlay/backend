import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DATABASE_POOL } from './constants/postgres.constants';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: (configService: ConfigService) => {
        return new Pool({
          host: configService.get('sql.host'),
          port: configService.get('sql.port'),
          database: configService.get('sql.database'),
          user: configService.get('sql.user'),
          password: configService.get('sql.password')
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_POOL],
})
export class PostgresModule {}