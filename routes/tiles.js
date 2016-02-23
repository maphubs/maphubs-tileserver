/* @flow weak */
var log = require('../services/log.js');

var path = require("path");

//var debug = require('../services/debug')('tiles');

var Sources = require('../services/tilelive-sources');

var apiError = require('../services/error-response').apiError;
var nextError = require('../services/error-response').nextError;

module.exports = function(app) {

  Sources.init();

  app.get('/tiles/layer/:layerid(\\d+)/:z(\\d+)/:x(\\d+)/:y(\\d+).pbf', function(req, res){

    var z = req.params.z;
    var x = req.params.x;
    var y =req.params.y;

    var layer_id = req.params.layerid;

    Sources.getSource(layer_id)
    .then(function(result){
      var source = result.source;
      if(!source){
        var msg = "Source not found for layer: " + layer_id;
        log.error(msg);
        res.status(500).send(msg);
        return;
      }

      source.getTile(z, x, y, function(err, data, headers) {
          if (err) {
              res.status(404);
              res.send(err.message);
              log.error(err.message);
              return;
          }
          if (data == null) {
            return res.status(404).send('Not found');
          }else {
            res.set(headers);
            return res.status(200).send(data);
          }
      });
    }).catch(apiError(res, 500));
  });

  app.get('/tiles/layer/:layerid(\\d+)/index.json', function(req, res, next) {

    var layer_id = parseInt(req.params.layerid);
    try{
        Sources.getInfo(layer_id)
    .then(function(info){
      var tilePath = "/{z}/{x}/{y}.{format}";
      
      var uri = "http://";
      if(process.env.USE_HTTPS){
          uri = "https://";
      }
      
      uri += req.headers.host +
        (path.dirname(req.originalUrl) +
                       tilePath.replace("{format}",'pbf')).replace(/\/+/g, "/");

      info.tiles = [uri];
      info.tilejson = "2.0.0";

      return res.status(200).send(info);
    }).catch(nextError(next));
    }catch(err){
        next(err);
    }
    
  });

};
