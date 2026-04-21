const { Sequelize } = require('sequelize');

const dialect = process.env.DB_DIALECT || 'postgres';

let sequelize;

if (dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './growth_system.sqlite',
    logging: process.env.NODE_ENV === 'development' ? console.log : false
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
