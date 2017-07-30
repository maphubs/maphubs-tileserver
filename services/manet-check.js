//@flow
var log = require('./log');
var local = require('../local');

module.exports = function(setCors: boolean){

return function(req: any, res: any, next: Function){

  var origin;
  if(local.useHttps){
    origin = 'https://';
  }else{
    origin = 'http://';
  }
  origin += local.host;

  var failure = function(){
    if(setCors) res.header('Access-Control-Allow-Origin', origin);
    return res.status(401).send("Unauthorized");
  };
  var success = function(){
    if(setCors) res.header('Access-Control-Allow-Origin', '*');
    next();
  };

  if(!local.requireLogin){
    return success();
  }

  if(req.isAuthenticated && req.isAuthenticated()){
    //allow authenticated request, but since this a require user restrict CORS
    if(setCors) res.header('Access-Control-Allow-Origin', origin);
    next();
  }else{
    //determine if this is the manet screenshot service
    if(req.cookies) log.info('cookies: ' + JSON.stringify(req.cookies));
    if(!req.cookies || !req.cookies.manet || req.cookies.manet !== local.manetAPIKey){
      log.error('Manet Cookie Not Found');
      return failure();
    }else{
      return success();
    }
  }
};
};
