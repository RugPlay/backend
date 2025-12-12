import { Inject } from '@nestjs/common';
import { DATABASE_POOL } from '../constants/postgres.constants';

export const InjectPostgres = () => Inject(DATABASE_POOL);