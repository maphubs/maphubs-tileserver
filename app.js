//@flow
var local = require('./local');
var express = require('express');
var consign = require('consign');
var logger = require('morgan');
var log = require('./services/log.js');
var responseTime = require("response-time");
var knex = require('./connection.js');
var cookieParser = require('cookie-parser');
var Raven = require('raven');
var version = require('./package.json').version;

require('babel-register')({});

var app = express();
app.enable('trust proxy');
app.disable("x-powered-by");

var ravenConfig = (process.env.NODE_ENV === 'production' && !local.disableTracking) && local.SENTRY_DSN;
Raven.config(ravenConfig, {
  release: 'tileserver-' + version,
  environment: process.env.NODE_ENV,
  tags: {host: local.host},
  parseUser: ['id', 'name', 'email']
}).install();

app.use(Raven.requestHandler());

app.use(responseTime());

app.use(logger('dev'));

app.use(cookieParser());

var restrictCors = false;
if(local.requireLogin && process.env.NODE_ENV === 'production'){
  restrictCors = true;
}

var session = require('express-session');
var KnexSessionStore = require('connect-session-knex')(session);
var passport = require('passport');
//set sessions (Note: putting this below static files to avoid extra overhead)
var sessionStore = new KnexSessionStore({
  /*eslint-disable*/
  knex: knex,
  /*eslint-enable*/
  tablename: 'maphubssessions' // optional. Defaults to 'sessions'
});

app.use(session({
  key: 'maphubs',
  secret: local.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  proxy: true,
  saveUninitialized: false,
  cookie: {
        path: '/',
        domain: local.host
    }
}));

app.use(passport.initialize());
app.use(passport.session());

//load passport auth config
require('./services/auth');

//CORS
app.use((req, res, next) => {
  if(!restrictCors){
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

//load all route files
consign().include('./routes').into(app);

var http = require('http');
var server = http.createServer(app);
server.setTimeout(10*60*1000); // 10 * 60 seconds * 1000 msecs
server.listen(local.internal_port, () => {
    log.info('**** STARTING SERVER ****');
    log.info('Server Running on port: ' + local.internal_port);
});
