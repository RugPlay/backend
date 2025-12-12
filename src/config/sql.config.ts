export default {
  host: process.env.SQL_DB_HOST || 'localhost',
  port: parseInt(process.env.SQL_DB_PORT || '5432', 10) || 5432,
  user: process.env.SQL_DB_USER || 'postgres',
  password: process.env.SQL_DB_PASSWORD || 'password',
  database: process.env.SQL_DB_SCHEMA || 'stonkwar',
};