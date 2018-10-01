// @flow
var Sources = require('../services/tilelive-sources')
var Layer = require('../models/layer')
var privateLayerCheck = require('../services/private-layer-check').middleware
var local = require('../local')
var log = require('../services/log.js')
var updateTiles = require('../services/update-tiles')

var checkLogin
var restrictCors = false
if (local.requireLogin) {
  if (process.env.NODE_ENV === 'production') {
    restrictCors = true
  }
  checkLogin = require('../services/manet-check').middleware(restrictCors)
} else {
  checkLogin = function (req, res, next) {
    next()
  }
}

module.exports = function (app: any) {
  app.get('/tiles/layer/:layer_id(\\d+)/updatetiles', checkLogin, privateLayerCheck, (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated() && req.session.user) {
      var user_id = req.session.user.maphubsUser.id
      var layer_id = parseInt(req.params.layerid)
      Layer.allowedToModify(layer_id, user_id)
        .then((allowed) => {
          if (allowed) {
            return Sources.getSource(layer_id)
              .then((result) => {
                return Layer.getLayerByID(layer_id)
                  .then((layer) => {
                    var source = result.source
                    if (!source) {
                      var msg = 'Source not found for layer: ' + layer_id
                      log.error(msg)
                      return res.status(500).send(msg)
                    } else {
                      var options = {
                        type: 'scanline',
                        minzoom: 0,
                        maxzoom: local.initMaxZoom ? local.initMaxZoom : 5,
                        bounds: layer.extent_bbox,
                        retry: undefined,
                        slow: undefined,
                        timeout: undefined,
                        close: true
                      }
                      return updateTiles(source, layer, options)
                        .then(() => {
                          return res.status(200).send({success: true})
                        })
                    }
                  })
              })
          } else {
            return res.status(401).send({
              success: false,
              error: 'Unauthorized'
            })
          }
        }).catch((err) => {
          log.error(err)
          res.status(200).send({success: false})
        })
    } else {
      res.status(401).send({
        success: false,
        error: 'Unauthorized'
      })
    }
  })
}
