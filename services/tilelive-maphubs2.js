//Modified from tilelive-tmsource https://github.com/mojodna/tilelive-tmsource
"use strict";
var url = require("url"),
    xml = require("xml"),
    util = require("util");

var Bridge = require("@mapbox/tilelive-bridge");
var Layer = require('../models/layer');
var debug = require('./debug')('MaphubsSource');
var local = require('../local');
var log = require('./log');
var fs = require('fs');

var tm = {};

// Named projections.
tm.srs = {
  'WGS84': '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs',
  '900913': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over'
};
tm.extent = {
    'WGS84': [-180, -90, 180, 90],
    '900913': [-20037508.34, -20037508.34, 20037508.34, 20037508.34]
};

var getLayer = function(layer_id){

  return Layer.getLayerByID(layer_id)
      .then(function(layer){
          if(layer == null){
              throw new Error("Layer not Found: " + layer_id);
          }

          var tableName = 'layers.data_full_' + layer.layer_id;

          var bounds = "";
          if(layer.extent_bbox){
            bounds = layer.extent_bbox;
          }

        var mapnikXML = {
          "Map": [
            { _attr:
              {
                "srs": tm.srs['900913'],
                "buffer-size": 8
              }
            },
            {
              "Parameters": [
                {"Parameter": { _attr: { "name":"name"}, _cdata: layer.name}},
                {"Parameter": { _attr: { "name":"description"}, _cdata: layer.name}},
                {"Parameter": { _attr: { "name":"attribution"}, _cdata: layer.source}},
                {"Parameter": { _attr: { "name":"bounds"}, _cdata:  bounds}},
                {"Parameter": [{ _attr: { "name":"center"}}, "0,0,3"]},
                {"Parameter": [{ _attr: { "name":"format"}}, "pbf"]},
                {"Parameter": [{ _attr: { "name":"minzoom"}}, 0]},
                {"Parameter": [{ _attr: { "name":"maxzoom"}}, 22]}
              ]
            },
            {
              "Layer": [
                {
                  _attr:
                  {
                    "name": "data",
                    "srs": tm.srs['900913'],
                    "buffer-size": 8,
                    "maximum-scale-denominator":1000000000,
                    "minimum-scale-denominator":100
                  }
                },
                {
                  "Datasource": [
                    {"Parameter": { _attr: { "name":"dbname"}, _cdata: local.database.database}},
                    {"Parameter": { _attr: { "name":"extent"}, _cdata: tm.extent['900913']}},
                    {"Parameter": { _attr: { "name":"geometry_field"}, _cdata: "geom"}},
                    {"Parameter": { _attr: { "name":"geometry_table"}, _cdata: ""}},
                    {"Parameter": { _attr: { "name":"host"}, _cdata: local.database.host}},
                    {"Parameter": { _attr: { "name":"max_size"}, _cdata: "256"}},
                    {"Parameter": { _attr: { "name":"password"}, _cdata:  local.database.password}},
                    {"Parameter": { _attr: { "name":"port"}, _cdata: ""}},
                    {"Parameter": { _attr: { "name":"table"}, _cdata: '(select \'' + local.host + '\' as maphubs_host, * from ' + tableName + ') data'}},
                    {"Parameter": { _attr: { "name":"type"}, _cdata: "postgis"}},
                    {"Parameter": { _attr: { "name":"user"}, _cdata: local.database.user}}
                  ]
                }
              ]
            }
        ]
      };

        //if polygon also add a centroid layer for labels
        if (layer.data_type == 'polygon'){

          var centroidLayer = {
            "Layer": [
              {
                _attr:
                {
                  "name": "data-centroids",
                  "srs": tm.srs['900913'],
                  "buffer-size": 64,
                  "maximum-scale-denominator":1000000000,
                  "minimum-scale-denominator":100
                }
              },
              {
                "Datasource": [
                  {"Parameter": { _attr: { "name":"dbname"}, _cdata: local.database.database}},
                  {"Parameter": { _attr: { "name":"extent"}, _cdata: tm.extent['900913']}},
                  {"Parameter": { _attr: { "name":"geometry_field"}, _cdata: "centroid"}},
                  {"Parameter": { _attr: { "name":"geometry_table"}, _cdata: ""}},
                  {"Parameter": { _attr: { "name":"host"}, _cdata: local.database.host}},
                  {"Parameter": { _attr: { "name":"max_size"}, _cdata: "256"}},
                  {"Parameter": { _attr: { "name":"password"}, _cdata:  local.database.password}},
                  {"Parameter": { _attr: { "name":"port"}, _cdata: ""}},
                  {"Parameter": { _attr: { "name":"table"}, _cdata: '(select \'' + local.host + '\' as maphubs_host, * from layers.centroids_' + layer_id + ') data'}},
                  {"Parameter": { _attr: { "name":"type"}, _cdata: "postgis"}},
                  {"Parameter": { _attr: { "name":"user"}, _cdata: local.database.user}}
                ]
              }
            ]
          };

          mapnikXML['Map'].push(centroidLayer);
        }

        return mapnikXML;
      });
};


var MaphubsSource = function(uri, callback) {
  uri = url.parse(uri);

  //Ex: maphubs://layer/1

  //TODO: implement combined vector tiles for multi-layer maps e.g. maphubs://map/1

  var self = this;

  var id = uri.path.split('/')[1];
  if(uri.host == 'layer' && id){
    var layer_id = id;

      return getLayer(layer_id)
       .then(function(layerXML){

           var xmlString = '<?xml version="1.0" encoding="utf-8"?>';
           xmlString += '<!DOCTYPE Map[]>';
           xmlString += xml(layerXML);

           if(local.writeDebugData){
             fs.writeFile(local.tempFilePath + '/mapnik-' + layer_id + '.xml', xmlString, function(err){
               if(err) {
                 log.error(err);
                 throw err;
               }
             });
           }

           uri.xml = xmlString;
           uri.base = uri.pathname;

           return Bridge.call(self, uri, callback);

         }).catch(function(err){
             return callback(err);
         });
  }else{
    return callback(new Error('Source type not supported: ' + uri.host));
  }

};

MaphubsSource.prototype.getInfo = function(callback) {
  return setImmediate(callback, null, this.info);
};

util.inherits(MaphubsSource, Bridge);

MaphubsSource.registerProtocols = function(tilelive) {
  debug('registerProtocols');
  tilelive.protocols["maphubs:"] = this;
};

module.exports = function(tilelive) {
  debug('MaphubsSource');
  MaphubsSource.registerProtocols(tilelive);

  return MaphubsSource;
};
