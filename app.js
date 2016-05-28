require('newrelic');
var express = require('express');
var load = require('express-load');
var logger = require('morgan');
var knex = require('./connection.js');
var log = require('./services/log.js');
var responseTime = require("response-time");
var local = require('./local');

var app = express();
app.enable('trust proxy');
app.disable("x-powered-by");

process.on('uncaughtException', function(err) {
  log.error('Caught exception: ' + err.stack);
});

app.use(responseTime());

//CORS
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

app.use(logger('dev'));

//load all route files using express-load
load('./routes').into(app);

var http = require('http');
var server = http.createServer(app);
server.setTimeout(10*60*1000); // 10 * 60 seconds * 1000 msecs
server.listen(local.internal_port, function () {
    log.info('**** STARTING SERVER ****');
    log.info('Server Running on port: ' + local.internal_port);
});
