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
        const password = configService.get('sql.password');
        return new Pool({
          host: configService.get('sql.host'),
          port: configService.get('sql.port'),
          database: configService.get('sql.database'),
          user: configService.get('sql.user'),
          password: password != null ? String(password) : undefined
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_POOL],
})
export class PostgresModule {}