//Modified from tilelive-tmsource https://github.com/mojodna/tilelive-tmsource
"use strict";
var path = require("path"),
    url = require("url"),
    util = require("util");

var _ = require("underscore"),
    Bridge = require("tilelive-bridge"),
    carto = require("carto"),
    mapnik = require("mapnik"),
    mapnikref = require('mapnik-reference').load(mapnik.versions.mapnik);

    var layerTemplate = require('./tmsource-template.json');
    var Layer = require('../models/layer');
    var debug = require('./debug')('MaphubsSource');
    var local = require('../local');
    var log = require('./log');

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



var defaults = {
  name:'',
  description:'',
  attribution:'',
  mtime:+new Date,
  minzoom:0,
  maxzoom:6,
  center:[0,0,3],
  Layer:[],
  _prefs: {
    saveCenter: true,
    disabled: [],
    inspector: false
  }
};

var deflayer = {
  id:'',
  srs:'',
  description:'',
  fields: {},
  Datasource: {},
  properties: {
    minzoom:0,
    maxzoom:22,
    'buffer-size':0
  }
};

// Initialize defaults and derived properties on source data.
var normalize = function(data) {
  data = _(data).defaults(defaults);
  // Initialize deep defaults for _prefs, layers.
  data._prefs = _(data._prefs).defaults(defaults._prefs);
  data.Layer = data.Layer.map(function(l) {
    l = _(l).defaults(deflayer);
    // @TODO mapnikref doesn't distinguish between keys that belong in
    // layer properties vs. attributes...
    l.properties = _(l.properties).defaults(deflayer.properties);
    // Ensure datasource keys are valid.
    l.Datasource = _(l.Datasource).reduce(function(memo, val, key) {
      if (!mapnikref.datasources[l.Datasource.type]) return memo;
      if (key === 'type') memo[key] = val;
      if (key in mapnikref.datasources[l.Datasource.type]) memo[key] = val;
      // Set a default extent value for postgis based on the SRS.
      if (l.Datasource.type === 'postgis' && key === 'extent' && !val) {
        _(tm.srs).each(function(srs, id) {
            if (l.srs !== srs) return;
            memo[key] = tm.extent[id];
        });
      }
      return memo;
    }, {});
    return l;
  });
  // Format property to distinguish from imagery tiles.
  data.format = 'pbf';
  // Construct vector_layers info from layer properties if necessary.
  data.vector_layers = data.Layer.map(function(l) {
    var info = {};
    info.id = l.id;
    if ('description' in l) info.description = l.description;
    if ('minzoom' in l.properties) info.minzoom = l.properties.minzoom;
    if ('maxzoom' in l.properties) info.maxzoom = l.properties.maxzoom;
    info.fields = [];
    var opts = _(l.Datasource).clone();


    try {
    var fields = new mapnik.Datasource(opts).describe().fields;
    info.fields = _(fields).reduce(function(memo, type, field) {
      memo[field] = l.fields[field] || type;
      return memo;
    }, {});
    }catch(err){
        //log.error(err);
    }
    return info;
  });
  return data;
};


var toXML = function(data, callback) {
  // Include params to be written to XML.
  var opts = [
    "name",
    "description",
    "attribution",
    "bounds",
    "center",
    "format",
    "minzoom",
    "maxzoom"
  ].reduce(function(memo, key) {
    if (key in data) {
      memo[key] = data[key];
    }

    return memo;
  }, {});

  opts.srs = tm.srs['900913'];

  opts.Layer = data.Layer.map(function(l) {
    l.srs = l.srs || tm.srs["900913"];
    l.name = l.id;
    return l;
  });

  opts.json = JSON.stringify({
    vector_layers: data.vector_layers
  });

  try {
    return callback(null, new carto.Renderer().render(opts));
  } catch(err) {
    if (Array.isArray(err)) {
        err.forEach(function(e) {
            carto.writeError(e, opts);
        });
    } else {
      return callback(err);
    }
  }
};

var getLayerSource = function(layer_id){

  return Layer.getLayerByID(layer_id)
      .then(function(layer){
          var layerDef  = JSON.parse(JSON.stringify(layerTemplate));
        var tableName = 'layers.';
        if(layer.data_type == 'point'){
          tableName += 'points';
        } else if (layer.data_type == 'line'){
          tableName += 'lines';
        } else if (layer.data_type == 'polygon'){
          tableName += 'polygons';
        } else {
          var msg = "layer data type not set";
          debug(msg);
        }
        tableName += '_' + layer.layer_id;
        layerDef.Layer[0].Datasource.host = local.database.host;
        layerDef.Layer[0].Datasource.dbname = local.database.database;
        layerDef.Layer[0].Datasource.user = local.database.user;
        layerDef.Layer[0].Datasource.password = local.database.password;
        layerDef.Layer[0].Datasource.table = tableName;
        layerDef.name = layer.name;
        layerDef.Layer[0].description = layer.name;
        layerDef.description = layer.description;
        layerDef.attribution = layer.source;
        if(layer.extent_bbox){
          layerDef.bounds = layer.extent_bbox;
        }
        return layerDef;
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

      return getLayerSource(layer_id)
       .then(function(layerDefinition){
           var info = layerDefinition;
           info.id = url.format(uri);
           info = normalize(info);
           return toXML(info, function(err, xml) {
             if (err) {
               return callback(err);
             }

             uri.xml = xml;
             uri.base = uri.pathname;

             return Bridge.call(self, uri, callback);
           });

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
