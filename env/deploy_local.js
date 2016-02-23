module.exports = {
  connection: {
    url: 'postgres://' + process.env.DB_USER + ':'+ process.env.DB_PASS +'@' + process.env.DB_HOST + ':' + process.env.DB_PORT + '/' + process.env.DB_DATABASE
  },
  host: process.env.OMH_HOST ? process.env.OMH_HOST : process.env.TUTUM_SERVICE_FQDN,
  port: process.env.OMH_PORT,
  internal_port: process.env.OMH_INTERNAL_PORT,
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT
  }
};