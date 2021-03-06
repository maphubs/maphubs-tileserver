// @flow
const local = require('./local')
const express = require('express')
const logger = require('morgan')
const log = require('./services/log.js')
const responseTime = require('response-time')
const knex = require('./connection.js')
const cookieParser = require('cookie-parser')
const Raven = require('raven')
const version = require('./package.json').version

let babelConfig = {
  presets: [
    ['env', {
      'targets': {
        'node': true
      }
    }],
    'stage-0'
  ],
  plugins: ['transform-flow-strip-types'],
  sourceMaps: false,
  retainLines: false
}

if (process.env.NODE_ENV !== 'production') {
  babelConfig.sourceMaps = true
  babelConfig.retainLines = true
}
require('babel-register')(babelConfig)

var app = express()
app.enable('trust proxy')
app.disable('x-powered-by')

var ravenConfig = (process.env.NODE_ENV === 'production' && !local.disableTracking) && local.SENTRY_DSN
Raven.config(ravenConfig, {
  release: 'tileserver-' + version,
  environment: process.env.NODE_ENV,
  tags: {host: local.host},
  parseUser: ['id', 'name', 'email']
}).install()

app.use(Raven.requestHandler())

app.use(responseTime())

app.use(logger('dev'))

app.use(cookieParser())

var restrictCors = false
if (local.requireLogin && process.env.NODE_ENV === 'production') {
  restrictCors = true
}

var session = require('express-session')
var KnexSessionStore = require('connect-session-knex')(session)
var passport = require('passport')
// set sessions (Note: putting this below static files to avoid extra overhead)
var sessionStore = new KnexSessionStore({
  knex,
  tablename: 'maphubssessions' // optional. Defaults to 'sessions'
})

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
}))

app.use(passport.initialize())
app.use(passport.session())

// load passport auth config
require('./services/auth')

// CORS
app.use((req, res, next) => {
  if (!restrictCors) {
    res.header('Access-Control-Allow-Origin', '*')
  }
  res.header('Access-Control-Allow-Credentials', true)
  res.header('Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  next()
})

// load all route files
require('./routes/tilejson')(app)
require('./routes/updatetiles')(app)
require('./routes/tiles')(app)

app.listen(local.internal_port, () => {
  log.info(`Server running on port ${local.internal_port}`)
})
