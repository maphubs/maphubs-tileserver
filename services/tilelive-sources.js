var log = require('./log.js');
var Layer = require('../models/layer');
var Promise = require('bluebird');
var debug = require('./debug')('tilelive-sources');
var local = require('../local');
var tilelive = require("tilelive");
require('./tilelive-maphubs2')(tilelive);
var fs = require('fs');
var updateTiles = require('./updateTiles');
var TILE_PATH = local.tilePath ? local.tilePath : '/data';
var lockFile = require('lockfile');

module.exports = {
  sources: {},

  getSource: function(layer_id){
    var _this = this;
    var source = _this.sources['layer-' + layer_id];
    if(!source){
       //this will dynamically register new layers on this server the first time they are requested
      return _this.loadSource(layer_id)
      .then(function(){
          var source = _this.sources['layer-' + layer_id];
          return source;
      });
    }else{
      return Layer.getLayerByID(layer_id)
      .then(function(layer){
        return new Promise(function(fulfill, reject){
        if(layer.last_updated > source.updated){    
          log.info('Source Update: ' +  source.updated + ' Layer Updated: ' + layer.last_updated);
          if(!source.updating){
            source.updating = true;
            //lockfile
            var lockfilePath = TILE_PATH + '/' + layer_id + '.lock'; 
            lockFile.lock(lockfilePath, {}, function (err) {          
              if(err){
                //falied to acquire lock, another instance is updating this source
                source.updating = false;
                log.error(err);
                fulfill(source);
              }else{
                log.info('lockfile created at:' + lockfilePath);
                //check metadata
                var metadataPath = TILE_PATH + '/' + layer_id + '/metadata.json';
                fs.readFile(metadataPath, function(err, data) {
                  if(err){
                    source.updating = false;
                    log.error(err);
                    fulfill(source);
                  } 
                  log.info('opened metadata: ' + metadataPath);
                  var metadata = JSON.parse(data);
                  if(layer.last_updated !== metadata.updated){
                    log.info('Updating Layer: ' + layer_id);
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
                    var updateTilesPromise = updateTiles(source, layer, options).then(function(){
                      source.updating = false;
                      source.updated = layer.last_updated;
                      metadata.updated = layer.last_updated;
                      //update metadata
                      return new Promise(function(fulfill, reject){
                        fs.writeFile(metadataPath, JSON.stringify(metadata), function(err){
                          if(err) {
                            source.updating = false;
                            log.error(err);                 
                          }
                          //close lockfile
                          lockFile.unlock(lockfilePath, function (err) {
                            if(err){
                              source.updating = false;
                              log.error(err);
                              reject(err);
                            } else{
                              log.info('closed lockfile');
                              fulfill(source);
                            }                         
                          });
                        });  
                      });                                       
                    });
                    fulfill(updateTilesPromise);
                  }else{
                    log.info('tiles already up to date, updating source object');
                    //the local source is just behind
                      source.updated = layer.last_updated;
                      lockFile.unlock(lockfilePath, function (err) {
                        if(err){
                          log.error(err);
                          reject(err);
                        }else{
                          log.info('closed lockfile');
                          fulfill(source);
                        } 
                      });                   
                  }
                });             
              }             
            });
          
           }else{
             log.warn('source already updating');
            fulfill(source);
          }          
        }else{
          fulfill(source);
        }
        });
      });     
    }
  },

  loadSource: function(layer_id){
    debug('loadSource: ' + layer_id);
    var _this = this;
    //add a source for the requested layer
    return Layer.getLayerByID(layer_id)
    .then(function(layer){
      return new Promise(function(fulfill, reject){
        return tilelive.load('maphubs://layer/' + layer_id, function(err, source) {
          if(err){
            reject(err);
          }else{
            log.info('Loaded Source for layer ID: ' + layer_id);
            _this.sources['layer-' + layer_id] = {source: source, updated: layer.last_updated};
            fulfill(source);
          }
        });
      });
    });
  },

  removeSource: function(layer_id){
    var _this = this;
    debug('removeSource: ' + layer_id);
    return new Promise(function(fulfill){
      var source = _this.sources['layer-' + layer_id];
      if(source){
        if(source.close){
          source.close(function(){
              debug('closed source for layer_id: ' + layer_id);
            delete _this.sources['layer-' + layer_id];
            fulfill();
          });
        }else{
          delete _this.sources['layer-' + layer_id];
          fulfill();
        }
      }else{
        fulfill();
      }
    });
  },

  //restart source to update it and clear tiles
  restartSource: function(layer_id){
    log.info('restartSource: ' + layer_id);
    var _this = this;
    return this.removeSource(layer_id)
    .then(function(){
      return _this.loadSource(layer_id);
    });
  },

  init: function(){
    var _this = this;
    //loop through all layers and setup sources for them
    Layer.getAllLayerIDs()
        .then(function(result){
          var initCommands = [];
          result.forEach(function(layer){
            var layer_id = parseInt(layer.layer_id);
            initCommands.push(_this.loadSource(layer_id).
            then(function(source){
                 //if tile files don't exist create them
                 if (!fs.existsSync(TILE_PATH + '/'+ layer_id)) {             
                  return Layer.getLayerByID(layer_id)
                  .then(function(layerObj){
                      var options = {
                      type: 'scanline',
                      minzoom: 0,
                      maxzoom: local.initMaxZoom ? local.initMaxZoom : 8,
                      bounds:layerObj.extent_bbox,
                      retry: undefined,
                      slow: undefined,
                      timeout: undefined,
                      close:true
                    };
                    return updateTiles(source, layerObj, options);
                  });
                }
            }));            
          });
          return Promise.all(initCommands).then(function(){
            log.info('Finished loading sources');
          });
        }).catch(function(err){
            log.error(err.message);
        });
  },

  getInfoHelper: function(source, layer){
    return new Promise(function(fulfill, reject){
      source.getInfo(function(err, _info) {
       if (err) {
         return reject(err);
       }

       var info = {};
       if(_info){
         Object.keys(_info).forEach(function(key) {
         info[key] = _info[key];
       });
       }
       

       if (info.vector_layers) {
         info.format = "pbf";
       }

       info.layer_id = layer.layer_id;
       info.updated = layer.last_updated;
       info.name = info.name || layer.name || "Untitled";
       info.center = info.center || [0, 0, 12];
       info.bounds = info.bounds || layer.extent_bbox || [-180, -85.0511, 180, 85.0511];
       info.format = "pbf";
       info.minzoom = Math.max(0, info.minzoom | 0);
       info.maxzoom = info.maxzoom || 22;
       info.group_id = layer.owned_by_group_id;
       info.description = info.description || layer.description;
       info.attribution = info.attribution || layer.source;

       fulfill(info);
     });
   });
  },

  getInfo: function(layer_id){
    var _this = this;
    return Layer.getLayerByID(layer_id)
    .then(function(layer){
      return _this.getSource(layer_id)
      .then(function(result){
        return _this.getInfoHelper(result.source, layer);
      });
    });
  }

};
