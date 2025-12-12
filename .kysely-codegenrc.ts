import sqlConfig from "./src/config/sql.config.ts";

console.log(`postgres://${sqlConfig.user}:${sqlConfig.password}@${sqlConfig.host}:${sqlConfig.port}/${sqlConfig.database}`);

export default {
    dialect: 'postgres',
    camelCase: false,
    outFile: 'src/database/types/db.d.ts',
    url: `postgres://${sqlConfig.user}:${sqlConfig.password}@${sqlConfig.host}:${sqlConfig.port}/${sqlConfig.database}`,
}