// @flow
var passport = require('passport')
var knex = require('../connection.js')
var log = require('./log.js')
var debug = require('./debug')('auth')

function translateUserObject (data) {
  var user = {
    id: data.id,
    display_name: data.display_name,
    description: data.description
  }
  return user
}

var find = function (id: number, done: Function) {
  debug('find by id: ' + id)
  return knex.select('*')
    .from('users')
    .where('id', id)
    .then((data) => {
      if (data.length === 1) {
        var user = translateUserObject(data[0])
        done(null, user)
        return null
      } else {
        // not found
        done('User Not Found: ' + id, null)
        return null
      }
    }).catch((err) => {
      log.error(err)
      return done(err, null)
    })
}

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((user, done) => {
  find(user.maphubsUser.id, (err, user) => {
    done(err, user)
  })
})
