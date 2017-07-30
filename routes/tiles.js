//@flow
var log = require('../services/log.js');
var fs = require('fs');
var Promise = require('bluebird');
//var debug = require('../services/debug')('tiles');
var Sources = require('../services/tilelive-sources');
var mkdirp = require('mkdirp');
var local = require('../local');
var TILE_PATH = local.tilePath ? local.tilePath : '/data';
var privateLayerCheck = require('../services/private-layer-check').middleware;

var checkLogin;
var restrictCors = false;
if(local.requireLogin){
  if(process.env.NODE_ENV === 'production'){
     restrictCors = true;
  }
  checkLogin = require('../services/manet-check')(restrictCors);
}else{
  checkLogin = function(req, res, next){
    next();
  };
}

module.exports = function(app: any) {

  Sources.init();

  app.get('/tiles/layer/:layer_id(\\d+)/:z(\\d+)/:x(\\d+)/:y(\\d+).pbf', checkLogin, privateLayerCheck, (req, res) =>{

    var z = req.params.z;
    var x = req.params.x;
    var y =req.params.y;

    var layer_id = req.params.layer_id;

    Sources.getSource(layer_id)
    .then((result)=>{
      var source = result.source;
      if(!source){
        var msg = "Source not found for layer: " + layer_id;
        log.error(msg);
        res.status(500).send(msg);
        return;
      }
      if(source.updating){
        //if source is alreading updating in another request, just return tiles from the database
         source.getTile(z, x, y, (err, newTileData, headers) => {
                if (err) {
                  res.status(404);
                  res.send(err.message);
                }else if(newTileData === null) {
                  res.status(404).send('Not found');
                }else {             
                  res.set(headers);
                  res.status(200).send(newTileData);
                }
              });
      }else{
        var fileDir = TILE_PATH + '/' + layer_id + '/' + z + '/' + x;
        var filePath = fileDir + '/' + y + '.pbf';

        fs.readFile(filePath, (err, data) => {
            if (err && err.code === 'ENOENT'){
               //didn't find the tile, so create it
              source.getTile(z, x, y, (err, newTileData, headers) => {
                if (err) {
                  res.status(404);
                  res.send(err.message);
                }else if(newTileData === null) {
                  res.status(404).send('Not found');

                }else {
                  mkdirp(fileDir, (err) => {
                      if (err){
                        log.error(err);
                      } 
                      fs.writeFile(filePath, newTileData, (err) => {
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
      
    }).catch((err)=>{
      if(err.message === "pool is draining and cannot accept work"){
        //manually recover from "stuck" sources that were unloaded from the cache
        log.error(err.message);
        return Sources.restartSource(layer_id)
        .then((source)=>{
          
          return new Promise((resolve, reject)=>{
            source.getTile(z, x, y, (err, data, headers)=>{
                if (err) {
                  res.status(404);
                  res.send(err.message);
                  reject(err);
                }else if(data === null) {
                  res.status(404).send('Not found');
                  resolve();
                }else {
                  var fileDir = TILE_PATH+ '/' + layer_id + '/' + z + '/' + x;
                  var filePath = fileDir + '/' + y + '.pbf';
                  mkdirp(fileDir, (err)=>{
                      if (err){
                        log.error(err);
                      } 
                      fs.writeFile(filePath, data, (err)=>{
                      if(err) {
                        log.error(err);                   
                      }
                  });
                  });
                  res.set(headers);
                  res.status(200).send(data);
                  resolve();
                }
            });
        });
        }).catch((err) =>{
          log.error("After Second Atempt: " + err.message);
        });
      }else{
        log.error(err.message);
      }
    });
  });
};