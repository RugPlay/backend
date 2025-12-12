import { defineConfig } from "kysely-ctl";
import * as path from "path";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";
import sqlConfig from "./src/config/sql.config";

const config = defineConfig({
    dialect: new PostgresDialect({
        pool: new Pool(sqlConfig),
    }),
    migrations: {
        migrationFolder: './src/database/migrations',
    },
    seeds: {
        seedFolder: './src/database/seeds',
    },
});

export default config;