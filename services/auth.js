/* @flow weak */
var passport = require('passport');
var db = require('./oauth-db');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  db.users.find(user.maphubsUser.id, function(err, user) {
    done(err, user);
  });
});
