/* @flow weak */
var log = require('../services/log.js');

var path = require("path");
var fs = require('fs');
var Promise = require('bluebird');

//var debug = require('../services/debug')('tiles');

var Sources = require('../services/tilelive-sources');
var nextError = require('../services/error-response').nextError;

var Layer = require('../models/layer');
var mkdirp = require('mkdirp');
var local = require('../local');
var updateTiles = require('../services/updateTiles');
var TILE_PATH = local.tilePath ? local.tilePath : '/data';
var privateLayerCheck = require('../services/private-layer-check').middleware;

module.exports = function(app) {

  Sources.init();

   
  app.get('/tiles/layer/:layer_id(\\d+)/:z(\\d+)/:x(\\d+)/:y(\\d+).pbf', privateLayerCheck, function(req, res){

    var z = req.params.z;
    var x = req.params.x;
    var y =req.params.y;

    var layer_id = req.params.layer_id;

    Sources.getSource(layer_id)
    .then(function(result){
      var source = result.source;
      if(!source){
        var msg = "Source not found for layer: " + layer_id;
        log.error(msg);
        res.status(500).send(msg);
        return;
      }
      if(source.updating){
        //if source is alreading updating in another request, just return tiles from the database
        source.getTile(z, x, y, function(err, newTileData, headers) {
                if (err) {
                  res.status(404);
                  res.send(err.message);
                }else if(newTileData == null) {
                  res.status(404).send('Not found');
                }else {             
                  res.set(headers);
                  res.status(200).send(newTileData);
                }
              });
      }else{
        var fileDir = TILE_PATH + '/' + layer_id + '/' + z + '/' + x;
        var filePath = fileDir + '/' + y + '.pbf';

        fs.readFile(filePath, function(err, data) {
            if (err && err.code === 'ENOENT'){
               //didn't find the tile, so create it
              source.getTile(z, x, y, function(err, newTileData, headers) {
                if (err) {
                  res.status(404);
                  res.send(err.message);
                }else if(newTileData == null) {
                  res.status(404).send('Not found');

                }else {
                  mkdirp(fileDir, function (err) {
                      if (err){
                        log.error(err);
                      } 
                      fs.writeFile(filePath, newTileData, function(err){
                      if(err) {
                        log.error(err);                   
                      }
                  });
                  });
                 
                  res.set(headers);
                  res.status(200).send(newTileData);

                }
              });
            }else if (err){
              //other reader error
              log.error(err.message);   
            }else{
              res.set({
                'Content-Type': 'application/x-protobuf',
                'Content-Encoding':'gzip'
              });
              res.status(200).send(data);
            }
        });
      }
      
    }).catch(function(err){
      if(err.message == "pool is draining and cannot accept work"){
        //manually recover from "stuck" sources that were unloaded from the cache
        log.error(err.message);
        return Sources.restartSource(layer_id)
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
                  var fileDir = TILE_PATH+ '/' + layer_id + '/' + z + '/' + x;
                  var filePath = fileDir + '/' + y + '.pbf';
                  mkdirp(fileDir, function (err) {
                      if (err){
                        log.error(err);
                      } 
                      fs.writeFile(filePath, data, function(err){
                      if(err) {
                        log.error(err);                   
                      }
                  });
                  });
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

   app.get('/tiles/layer/:layer_id(\\d+)/updatetiles', privateLayerCheck, function(req, res) {

    if(req.isAuthenticated && req.isAuthenticated() && req.session.user){
      var user_id = req.session.user.maphubsUser.id;
      var layer_id = parseInt(req.params.layerid);
      Layer.allowedToModify(layer_id, user_id)
      .then(function(allowed){
        if(allowed){
       return Sources.getSource(layer_id)
      .then(function(result){
        return Layer.getLayerByID(layer_id)
        .then(function(layer){
          var source = result.source;
          if(!source){
            var msg = "Source not found for layer: " + layer_id;
            log.error(msg);
            res.status(500).send(msg);
            return;
          }
          var options = {
              type: 'scanline',
              minzoom: 0,
              maxzoom: local.initMaxZoom ? local.initMaxZoom : 5,
              bounds:layer.extent_bbox,
              retry: undefined,
              slow: undefined,
              timeout: undefined,
              close:true
            };
            return updateTiles(source, layer_id, options)
            .then(function(){
              res.status(200).send({success: true});
            });    
        });
        });
        }else{
          res.status(401).send({
            success: false,
            error: "Unauthorized"
          });
        }
      }).catch(function(err){
          log.error(err);
          res.status(200).send({success: false});
      });
    }else{
      res.status(401).send({
        success: false,
        error: "Unauthorized"
      });
    }
  });
};
