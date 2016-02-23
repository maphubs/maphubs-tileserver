var log = require('./log');
module.exports = {

  apiError: function(res, code){
    return function(err){
      log.error(err);
      res.status(code).send({success: false,error: err.toString()});
    };
  },

  nextError: function(next){
    return function(err){
      log.error(err);
      next(err);
    };
  }


};
