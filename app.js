var local = require('./local');
if(!local.disableTracking) require('newrelic');
var express = require('express');
var load = require('express-load');
var logger = require('morgan');
var log = require('./services/log.js');
var responseTime = require("response-time");
var knex = require('./connection.js');
var cookieParser = require('cookie-parser');

var app = express();
app.enable('trust proxy');
app.disable("x-powered-by");

process.on('uncaughtException', function(err) {
  log.error('Caught exception: ' + err.stack);
});

app.use(responseTime());

app.use(logger('dev'));

app.use(cookieParser());
var checkLogin;

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

if(local.requireLogin){
   checkLogin = require('./services/manet-check')(restrictCors, true);
}else{
  checkLogin = function(req, res, next){
    next();
  };
}

app.use(checkLogin);

//CORS
app.use(function(req, res, next) {
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

//load all route files using express-load
load('./routes').into(app);

var http = require('http');
var server = http.createServer(app);
server.setTimeout(10*60*1000); // 10 * 60 seconds * 1000 msecs
server.listen(local.internal_port, function () {
    log.info('**** STARTING SERVER ****');
    log.info('Server Running on port: ' + local.internal_port);
});
