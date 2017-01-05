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
  initMaxZoom: process.env.OMH_INIT_MAX_ZOOM,
  tilePath: process.env.OMH_TILE_PATH,
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT
  },
  requireLogin: process.env.OMH_REQUIRE_LOGIN == 'true',
  SESSION_SECRET:  process.env.OMH_SESSION_SECRET,
  manetUrl: process.env.OMH_MANET_URL,
  manetAPIKey: process.env.OMH_MANET_API_KEY
};
