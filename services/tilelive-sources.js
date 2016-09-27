var log = require('./log.js');
var Layer = require('../models/layer');
var Promise = require('bluebird');

var debug = require('./debug')('tilelive-sources');

var tilelive = require("tilelive");
require('./tilelive-maphubs2')(tilelive);

var cache = require("tilelive-cache")(tilelive, {
  size: 5,      // 10MB cache (the default)
  sources: 250    // cache a maximum of 6 sources (the default); you may
                 // need to change this if you're using lots of
                 // composed sources
});

module.exports = {
  sources: {},

  getSource: function(layer_id){
      var _this = this;
    return new Promise(function(fulfill, reject){
     var source = _this.sources['layer-' + layer_id];
     if(!source){
       //this will dynamically register new layers on this server the first time they are requested
       return _this.loadSource(layer_id)
       .then(function(){
           var source = _this.sources['layer-' + layer_id];
         fulfill(source);
       }).catch(function(err){
           reject(err);
       });
     }else{
       fulfill(source);
    }
   });
  },

  loadSource: function(layer_id){
    debug('loadSource: ' + layer_id);
    var _this = this;
    //add a source for the requested layer
    return Layer.getLayerByID(layer_id)
    .then(function(layer){
      return new Promise(function(fulfill, reject){
        //adding last_updated to the tilelive URI to bust the cache when a layer updates
        return cache.load('maphubs://layer/' + layer_id + '/' + layer.last_updated, function(err, source) {
          if(err){
            //log.error(err);
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

  //restart source to update it and clear cache
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
          result.forEach(function(layer){
            var layer_id = parseInt(layer.layer_id);
            return _this.loadSource(layer_id).
            then(function(){
                  //warm the cache
                 return cache.load('maphubs://layer/' + layer.layer_id);
            })
            .catch(function(err){
                log.error(err.message);
            });
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

       Object.keys(_info).forEach(function(key) {
         info[key] = _info[key];
       });

       if (info.vector_layers) {
         info.format = "pbf";
       }

       info.layer_id = layer.layer_id;
       info.updated = layer.last_updated;
       info.name = info.name || "Untitled";
       info.center = info.center || [-122.4440, 37.7908, 12];
       info.bounds = info.bounds || [-180, -85.0511, 180, 85.0511];
       info.format = "pbf";
       info.minzoom = Math.max(0, info.minzoom | 0);
       info.maxzoom = info.maxzoom || Infinity;
       info.group_id = layer.owned_by_group_id;

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
        var source = result.source;

        //check if layer has been updated
        var updated = result.updated;
        if(layer.last_updated > updated){
          log.info('Reloading Updated Layer: ' + layer_id);
          return _this.restartSource(layer_id)
          .then(function(newSource){
            return _this.getInfoHelper(newSource, layer);
          });
        }else{
          return _this.getInfoHelper(source, layer);
        }
      });
    });
  }

};
