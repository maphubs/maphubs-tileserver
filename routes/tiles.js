/* @flow weak */
var Layer = require('../models/layer');
var log = require('../services/log.js');

var path = require("path");

//var debug = require('../services/debug')('tiles');

var Sources = require('../services/tilelive-sources');


var apiError = require('../services/error-response').apiError;


module.exports = function(app) {


  Sources.init();


  app.get('/layer/:layerid(\\d+)/:z(\\d+)/:x(\\d+)/:y(\\d+).pbf', function(req, res){

        var z = req.params.z;
        var x = req.params.x;
        var y =req.params.y;

        var layer_id = req.params.layerid;

        var source = Sources.sources['layer-' + layer_id];
        if(!source){
          var msg = "Source not found for layer: " + layer_id;
          log.error(msg);
          res.status(500).send(msg);
          return;
        }

        source.getTile(z, x, y, function(err, data, headers) {
            if (err) {
                res.status(404);
                res.send(err.message);
                log.error(err.message);
                return;
            }
            if (data == null) {
              return res.status(404).send('Not found');
            }else {
              res.set(headers);
              return res.status(200).send(data);
            }
        });
    });


    app.get('/layer/:layerid(\\d+)/index.json', function(req, res, next) {

   var layer_id = parseInt(req.params.layerid);


   var source = Sources.sources['layer-' + layer_id];
   if(!source){
     var msg = "Source not found for layer: " + layer_id;
     log.error(msg);
     res.status(500).send(msg);
     return;
   }
     return Sources.getInfo(layer_id, function(err, info) {
       if (err) {
         return next(err);
       }
       var tilePath = "/{z}/{x}/{y}.{format}";
       var uri = "http://" + req.headers.host +
         (path.dirname(req.originalUrl) +
                        tilePath.replace("{format}",'pbf')).replace(/\/+/g, "/");

       info.tiles = [uri];
       info.tilejson = "2.0.0";

       return res.status(200).send(info);
     });

 });

  app.get('/api/tiles/init/:layerid', function(req, res) {

    if (!req.session || !req.session.user) {
      res.status(401).send("Unauthorized, user not logged in");
      return;
    }

    var user_id = req.session.user.id;
    var layer_id = parseInt(req.params.layerid || '', 10);

    Layer.allowedToModify(layer_id, user_id)
    .then(function(allowed){
      if(allowed){
        //either starts or restarts the source
        Sources.restartSource(layer_id)
          .then(function(){
              res.status(200).send({success: true});
          }).catch(apiError(res, 500));
      } else {
          res.status(401).send({success:false, error: 'Unauthorized'});
      }
    }).catch(apiError(res, 500));

  });

};
