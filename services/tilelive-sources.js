//@flow
var log = require('./log.js');
var Layer = require('../models/layer');
var Promise = require('bluebird');
var debug = require('./debug')('tilelive-sources');
var local = require('../local');
var tilelive = require("@mapbox/tilelive");
require('./tilelive-maphubs2')(tilelive);
var fs: typeof fs = Promise.promisifyAll(require("fs"));
var updateTiles = require('./update-tiles');
var TILE_PATH = local.tilePath ? local.tilePath : '/data';
var lockFile = Promise.promisifyAll(require('lockfile'));

module.exports = {
  sources: {},

  getSource(layer_id: number){
    var _this = this;
    var source = _this.sources['layer-' + layer_id];
    if(!source){
       //this will dynamically register new layers on this server the first time they are requested
      return _this.loadSource(layer_id)
      .then(()=>{
          var source = _this.sources['layer-' + layer_id];
          return source;
      });
    }else{
      return Layer.getLayerByID(layer_id)
      .then((layer)=>{
        if(layer.last_updated > source.updated){    
          log.info('Source Update: ' +  source.updated + ' Layer Updated: ' + layer.last_updated);
          if(!source.updating){
            source.updating = true;
            //lockfile
            var lockfilePath = TILE_PATH + '/' + layer_id + '.lock'; 
            return lockFile.lockAsync(lockfilePath, {})
            .then(()=>{
              log.info('lockfile created at:' + lockfilePath);
                

                var updateTilesHelper = function(source, layer, options, metadata){
                return updateTiles(source, layer, options).then(()=>{
                      source.updating = false;
                      source.updated = layer.last_updated;
                      metadata.updated = layer.last_updated;
                      //update metadata
                      
                      return fs.writeFileAsync(metadataPath, JSON.stringify(metadata))
                      .then(()=>{
                        //close lockfile
                        return lockFile.unlockAsync(lockfilePath)
                        .then(()=>{
                          log.info('closed lockfile');
                          return source;
                        }).catch(err=>{
                          source.updating = false;
                          log.error(err);
                        });
                      }).catch(err=>{
                        source.updating = false;
                        log.error(err); 
                      });                                      
                    });
                };

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

                //check metadata
                var metadataPath = TILE_PATH + '/' + layer_id + '/metadata.json';

                if(!fs.existsSync(metadataPath)){ 
                  log.info('Updating Layer: ' + layer_id);    
                  return updateTilesHelper(source, layer, options, {});
                }else{

                return fs.readFileAsync(metadataPath)
                .then(data=>{
                  log.info('opened metadata: ' + metadataPath);
                  var metadata = JSON.parse(data);
                  if(layer.last_updated !== metadata.updated){
                    log.info('Updating Layer: ' + layer_id);                   
                    return updateTilesHelper(source, layer, options, metadata);
                  }else{
                    log.info('tiles already up to date, updating source object');
                    //the local source is just behind
                      source.updated = layer.last_updated;
                      return lockFile.unlockAsync(lockfilePath)
                      .then(()=>{
                        log.info('closed lockfile');
                        return source;
                      });                                     
                  }
                });
                }
            }).catch(err=>{
              source.updating = false;
              log.error(err);
              return source;
            });                   
           }else{
            log.warn('source already updating');
            return source;
          }          
        }else{
          return source;
        }
      });     
    }
  },

  loadSource(layer_id: number){
    debug('loadSource: ' + layer_id);
    var _this = this;
    //add a source for the requested layer
    return Layer.getLayerByID(layer_id)
    .then((layer)=>{
      return new Promise((resolve, reject)=>{
        return tilelive.load('maphubs://layer/' + layer_id, (err, source) => {
          if(err){
            reject(err);
          }else{
            log.info('Loaded Source for layer ID: ' + layer_id);
            _this.sources['layer-' + layer_id] = {source, updated: layer.last_updated};
            resolve(source);
          }
        });
      });
    });
  },

  removeSource(layer_id: number){
    var _this = this;
    debug('removeSource: ' + layer_id);
    return new Promise((resolve)=>{
      var source = _this.sources['layer-' + layer_id];
      if(source){
        if(source.close){
          source.close(()=>{
              debug('closed source for layer_id: ' + layer_id);
            delete _this.sources['layer-' + layer_id];
            resolve();
          });
        }else{
          delete _this.sources['layer-' + layer_id];
          resolve();
        }
      }else{
        resolve();
      }
    });
  },

  //restart source to update it and clear tiles
  restartSource(layer_id: number){
    log.info('restartSource: ' + layer_id);
    var _this = this;
    return this.removeSource(layer_id)
    .then(()=>{
      return _this.loadSource(layer_id);
    });
  },

  init(){
    var _this = this;
    //loop through all layers and setup sources for them
    Layer.getAllLayerIDs()
        .then((result)=>{
          var initCommands = [];
          result.forEach((layer)=>{
            var layer_id = parseInt(layer.layer_id);
            initCommands.push(_this.loadSource(layer_id).
            then((source)=>{
                 //if tile files don't exist create them
                 /* eslint-disable security/detect-non-literal-fs-filename */
                 if(!fs.existsSync(TILE_PATH + '/'+ layer_id)) {             
                  return Layer.getLayerByID(layer_id)
                  .then((layerObj)=>{
                      var options = {
                      type: 'scanline',
                      minzoom: 0,
                      maxzoom: local.initMaxZoom ? local.initMaxZoom : 5,
                      bounds:layerObj.extent_bbox,
                      retry: undefined,
                      slow: undefined,
                      timeout: undefined,
                      close:true
                    };
                    return updateTiles(source, layerObj, options);
                  });
                }else{
                  return;
                }
            }));            
          });
          return Promise.all(initCommands).then(()=>{
            log.info('Finished loading sources');
            return;
          });
        }).catch((err) =>{
            log.error(err.message);
        });
  }
};