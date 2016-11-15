var log = require('./log');
var local = require('../local');

module.exports = function(req, res, next){
  if(local.requireLogin && (!req.isAuthenticated || !req.isAuthenticated())){
    //determine if this is the manet screenshot service
    var fail = false;
    var forwardedIP = req.headers['x-forwarded-for'];

    var ip = req.connection.remoteAddress;
    var manetUrl = local.manetUrl;
    var manetHost = require('url').parse(manetUrl).hostname;
    require('dns').lookup(manetHost, function(err, addresses) {
      log.info('valid manet addresses:', addresses);
      if(!addresses.includes(ip) && !addresses.includes(forwardedIP) ){
        log.error('Unauthenticated screenshot request, manet IP does not match');
        fail = true;
      }
      if(fail){
        return res.status(401).send("Unauthorized");
      }else{
        res.header('Access-Control-Allow-Origin', '*');
        next();
      }
    });  
  }else{
    res.header('Access-Control-Allow-Origin', local.host);
    next();
  }
};
