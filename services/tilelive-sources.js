
var log = require('./log.js');
var Layer = require('../models/layer');

var debug = require('./debug')('tilelive-sources');

var tilelive = require("tilelive");
var MaphubsSource = require('./tilelive-maphubs')(tilelive);


var cache = require("tilelive-cache")(tilelive, {
  size: 10,      // 10MB cache (the default)
  sources: 100    // cache a maximum of 6 sources (the default); you may
                 // need to change this if you're using lots of
                 // composed sources
});



module.exports = {
  sources: {},

  loadSource: function(layer_id){
    debug('loadSource: ' + layer_id);
    var _this = this;
    //add a source for the requested layer
    return cache.load('maphubs://layer/' + layer_id, function(err, source) {
      if(err){
        log.error(err);
      }else{
        log.info('Loaded Source for layer ID: ' + layer_id);
        _this.sources['layer-' + layer_id] = source;
      }
    });
  },

  removeSource: function(layer_id){
    debug('removeSource: ' + layer_id);
    return new Promise(function(fulfill){
      if(this.sources['layer-' + layer_id]){
        delete this.sources['layer-' + layer_id];
      }
      fulfill();
    });
  },

  //restart source to update it and clear cache
  restartSource: function(layer_id){
    debug('restartSource: ' + layer_id);
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
              var layer_id = parseInt(layer.layer_id)
            return _this.loadSource(layer_id);
          });
        });
  },

  getInfo: function(layer_id, callback){
    var source = this.sources['layer-' + layer_id];
    if(!source){
      callback(new Error('Source not found for: ' + layer_id));
    }else{
      return source.getInfo(function(err, _info) {
    if (err) {
      return callback(err);
    }

    var info = {};

    Object.keys(_info).forEach(function(key) {
      info[key] = _info[key];
    });

    if (info.vector_layers) {
      info.format = "pbf";
    }

    info.name = info.name || "Untitled";
    info.center = info.center || [-122.4440, 37.7908, 12];
    info.bounds = info.bounds || [-180, -85.0511, 180, 85.0511];
    info.format = "pbf";
    info.minzoom = Math.max(0, info.minzoom | 0);
    info.maxzoom = info.maxzoom || Infinity;

    return callback(null, info);
  });
    }
  }

};
