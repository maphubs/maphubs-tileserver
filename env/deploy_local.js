module.exports = {
  connection: {
    url: 'postgres://' + process.env.DB_USER + ':'+ process.env.DB_PASS +'@' + process.env.DB_HOST + ':' + process.env.DB_PORT + '/' + process.env.DB_DATABASE
  },
  host: process.env.OMH_HOST ? process.env.OMH_HOST : process.env.TUTUM_SERVICE_FQDN,
  port: process.env.OMH_PORT,
  internal_port: process.env.OMH_INTERNAL_PORT,
  NEWRELIC_APP_NAME: process.env.OMH_NEWRELIC_APP_NAME,
  NEWRELIC_LICENSE: process.env.OMH_NEWRELIC_LICENSE,
  NEWRELIC_LOG_LEVEL: process.env.OMH_NEWRELIC_LOG_LEVEL,
  disableTracking:  process.env.OMH_DISABLE_TRACKING  == 'true',
  useHttps: process.env.USE_HTTPS == 'true',
  writeDebugData: process.env.OMH_WRITEDEBUGDATA == 'true',
  cacheMemSize: process.env.OMH_CACHE_MEMSIZE,
  cacheSources: process.env.OMH_CACHE_SOURCES,
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT
  }
};
