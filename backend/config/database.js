const { Sequelize } = require('sequelize');
const path = require('path');

const dialect = process.env.DB_DIALECT || 'postgres';

let sequelize;

if (dialect === 'sqlite') {
  // 使用绝对路径避免 pm2 工作目录变化导致的路径问题
  const dbPath = process.env.DB_STORAGE || path.resolve(__dirname, '..', 'growth_system.sqlite');
  console.log(`[DB] SQLite 路径: ${dbPath}`);

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      mode: require('sqlite3').OPEN_READWRITE | require('sqlite3').OPEN_CREATE
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'growth_system',
    process.env.DB_USER || 'growth',
    process.env.DB_PASSWORD || 'growth123',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
}

module.exports = sequelize;
