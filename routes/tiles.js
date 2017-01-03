/* @flow weak */
var log = require('../services/log.js');

var path = require("path");

var Promise = require('bluebird');

//var debug = require('../services/debug')('tiles');

var Sources = require('../services/tilelive-sources');

var apiError = require('../services/error-response').apiError;
var nextError = require('../services/error-response').nextError;

var local = require('../local');

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
      return new Promise(function(fulfill, reject){
        source.getTile(z, x, y, function(err, data, headers) {
            if (err) {
              res.status(404);
              res.send(err.message);
              reject(err);
            }else if(data == null) {
              res.status(404).send('Not found');
              fulfill();
            }else {
              res.set(headers);
              res.status(200).send(data);
              fulfill();
            }
        });
      });

    }).catch(function(err){
      if(err.message == "pool is draining and cannot accept work"){
        //manually recover from "stuck" sources that were unloaded from the cache
        log.error(err.message);
        Sources.restartSource(layer_id)
        .then(function(source){
          return new Promise(function(fulfill, reject){
            source.getTile(z, x, y, function(err, data, headers) {
                if (err) {
                  res.status(404);
                  res.send(err.message);
                  reject(err);
                }else if(data == null) {
                  res.status(404).send('Not found');
                  fulfill();
                }else {
                  res.set(headers);
                  res.status(200).send(data);
                  fulfill();
                }
            });
        });
        }).catch(function(err){
          log.error("After Second Atempt: " + err.message);
        });
      }else{
        log.error(err.message);
      }

    });

  });

  app.get('/tiles/layer/:layerid(\\d+)/index.json', function(req, res, next) {

    var layer_id = parseInt(req.params.layerid);
    try{
        Sources.getInfo(layer_id)
    .then(function(info){

      var uri = "http://";
      if(local.useHttps){
          uri = "https://";
      }

      uri += req.headers.host;

      if(local.port !== 80 && local.port !== '80' && !req.headers.host.includes(':')){
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
