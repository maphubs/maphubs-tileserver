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

   app.get('/tiles/layer/:layerid(\\d+)/updatetiles', function(req, res, next) {

    var layer_id = parseInt(req.params.layerid);
       Sources.getSource(layer_id)
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
            maxzoom: local.initMaxZoom ? local.initMaxZoom : 8,
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
     
  }).catch(function(err){
      log.error(err);
      res.status(200).send({success: false});
  });
  });
};
