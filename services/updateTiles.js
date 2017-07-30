//@flow
var tilelive = require('@mapbox/tilelive');
var log = require('./log.js');
var exec = require('child_process').exec;
var Promise = require('bluebird');
var local = require('../local');
var TILE_PATH = local.tilePath ? local.tilePath : '/data';
var fs = require('fs');

module.exports = function(source: Object, layer: Object, options: Object){

  return new Promise((resolve, reject) => {
    
    var seedTiles = function(){
       var srcuri = 'maphubs://layer/' + layer.layer_id;
      var dsturi = 'file://'+ TILE_PATH + '/' + layer.layer_id + '?filetype=pbf';

      tilelive.copy(srcuri, dsturi, options, (err) => {
        if (err){
          log.error(err.message);
          reject(err);
        }else{
          resolve();
        }                  
      });
    };
    var tilePath = TILE_PATH + '/' + layer.layer_id;
    if (fs.existsSync(tilePath)) { 
      exec('rm -r ' + tilePath, (err, stdout, stderr) => {
      if(err){
        log.error(err.message);
        log.error(stderr);
      } 
      seedTiles();    
    });
    }else{
      seedTiles();
    }   
  });
};