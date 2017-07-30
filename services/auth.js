//@flow
var passport = require('passport');
var db = require('./oauth-db');

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  db.users.find(user.maphubsUser.id, (err, user) => {
    done(err, user);
  });
});
