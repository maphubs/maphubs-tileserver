
var Sources = require('../services/tilelive-sources');
var privateLayerCheck = require('../services/private-layer-check').middleware;
var local = require('../local');
var nextError = require('../services/error-response').nextError;
var path = require("path");

module.exports = function(app) {

 app.get('/tiles/layer/:layer_id(\\d+)/index.json', privateLayerCheck, function(req, res, next) {

    var layer_id = parseInt(req.params.layer_id);
    try{
        Sources.getInfo(layer_id)
    .then(function(info){

      var uri = "http://";
      if(local.useHttps){
          uri = "https://";
      }

      uri += local.host;

      if(local.port !== 80 && local.port !== '80'){
        uri += ':' + local.port;
      }

      uri +=
        (path.dirname(req.originalUrl) + "/{z}/{x}/{y}.pbf").replace(/\/+/g, "/");

      info.tiles = [uri];
      info.tilejson = "2.0.0";

      return res.status(200).send(info);
    }).catch(nextError(next));
    }catch(err){
        next(err);
    }
  });

};