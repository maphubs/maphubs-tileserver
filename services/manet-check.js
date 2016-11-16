var log = require('./log');
var local = require('../local');

module.exports = function(req, res, next){
  if(local.requireLogin && (!req.isAuthenticated || !req.isAuthenticated())){
    //determine if this is the manet screenshot service
    var fail = false;
    var forwardedIP = req.headers['x-forwarded-for'];

    var ip = req.connection.remoteAddress;
    log.error('RemoteAddress:' + ip);
    log.error('x-forwarded-for:' + forwardedIP);
    var manetUrl = local.manetUrl;
    if(process.env.MANET_PORT_8891_TCP_ADDR
      && process.env.MANET_PORT_8891_TCP_ADDR !== ip
      && process.env.MANET_PORT_8891_TCP_ADDR !== forwardedIP){
        log.error('Unauthenticated screenshot request, manet IP does not match');      
        log.error('Expected IP:' + process.env.MANET_PORT_8891_TCP_ADDR);
        res.header('Access-Control-Allow-Origin', local.host);
        return res.status(401).send("Unauthorized");
    }else{
      var manetHost = require('url').parse(manetUrl).hostname;
      require('dns').lookup(manetHost, function(err, addresses) {
        if(err){
          log.error(err);
          fail = true;
        }else if(!Array.isArray(addresses)){
          log.error("Failed to lookup manet addresses");
          fail = true;
        }else{
          log.info('valid manet addresses:', addresses);
          if(!addresses.includes(ip) && !addresses.includes(forwardedIP) ){
            log.error('Unauthenticated screenshot request, manet IP does not match');
            fail = true;
          }
        }
        if(fail){
          res.header('Access-Control-Allow-Origin', local.host);
          return res.status(401).send("Unauthorized");
        }else{
          res.header('Access-Control-Allow-Origin', '*');
          next();
        }
      });
    }

  }else{
    res.header('Access-Control-Allow-Origin', local.host);
    next();
  }
};
