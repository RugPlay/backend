declare namespace NodeJS {
    interface ProcessEnv {
      // System Configuration
      NODE_ENV: 'local' | 'development' | 'test' | 'production';
  
      // App Configuration
      APP_NAME?: string;
      APP_DOMAIN?: string;
      APP_PORT?: string;
      APP_SECRET?: string;
  
      // Cookie Configuration
      COOKIE_DOMAIN?: string;
  
      // SQL Database Configuration
      SQL_DB_HOST?: string;
      SQL_DB_PORT?: string;
      SQL_DB_USERNAME?: string;
      SQL_DB_PASSWORD?: string;
      SQL_DB_SCHEMA?: string;
  
      // Redis Configuration
      REDIS_HOST?: string;
      REDIS_PORT?: string;
      REDIS_DB?: string;
      REDIS_PASSWORD?: string;
      REDIS_PREFIX?: string;
    }
  }