// @flow
var log = require('../services/log.js')
var fs = require('fs')
var Promise = require('bluebird')
var Sources = require('../services/tilelive-sources')
var mkdirp = require('mkdirp')
var local = require('../local')
var TILE_PATH = local.tilePath ? local.tilePath : '/data'
var privateLayerCheck = require('../services/private-layer-check')

var Layer = require('../models/layer')
var manetCheck = require('../services/manet-check').check
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
  Sources.init()

  var completeTileRequest = function (req, res, layer_id, z, x, y) {
    return Sources.getSource(layer_id)
      .then((result) => {
        var source = result.source
        if (!source) {
          var msg = 'Source not found for layer: ' + layer_id
          log.error(msg)
          res.status(500).send(msg)
          return
        }
        if (source.updating) {
        // if source is alreading updating in another request, just return tiles from the database
          return new Promise((resolve) => {
            return source.getTile(z, x, y, (err, newTileData, headers) => {
              if (err) {
                res.status(404)
                res.send(err.message)
              } else if (newTileData === null) {
                res.status(404).send('Not found')
              } else {
                res.set(headers)
                res.status(200).send(newTileData)
                resolve()
              }
            })
          })
        } else {
          var fileDir = TILE_PATH + '/' + layer_id + '/' + z + '/' + x
          var filePath = fileDir + '/' + y + '.pbf'

          return new Promise((resolve, reject) => {
            /* eslint-disable security/detect-non-literal-fs-filename */
            // TILE_PATH is loaded from env, other params are parsed to integer
            fs.readFile(filePath, (err, data) => {
              if (err && err.code === 'ENOENT') {
                // didn't find the tile, so create it
                source.getTile(z, x, y, (err, newTileData, headers) => {
                  if (err) {
                    res.status(404)
                    res.send(err.message)
                  } else if (newTileData === null) {
                    res.status(404).send('Not found')
                  } else {
                    mkdirp(fileDir, (err) => {
                      if (err) {
                        log.error(err)
                      }
                      fs.writeFile(filePath, newTileData, (err) => {
                        if (err) {
                          log.error(err)
                        }
                      })
                    })

                    res.set(headers)
                    res.status(200).send(newTileData)
                  }
                })
              } else if (err) {
              // other reader error
                log.error(err.message)
                reject(err)
              } else {
                res.set({
                  'Content-Type': 'application/x-protobuf',
                  'Content-Encoding': 'gzip'
                })
                res.status(200).send(data)
                resolve()
              }
            })
            /* eslint-enable security/detect-non-literal-fs-filename */
          })
        }
      }).catch((err) => {
        if (err.message === 'pool is draining and cannot accept work') {
        // manually recover from "stuck" sources that were unloaded from the cache
          log.error(err.message)
          return Sources.restartSource(layer_id)
            .then((source) => {
              return new Promise((resolve, reject) => {
                source.getTile(z, x, y, (err, data, headers) => {
                  if (err) {
                    res.status(404)
                    res.send(err.message)
                    reject(err)
                  } else if (data === null) {
                    res.status(404).send('Not found')
                    resolve()
                  } else {
                    var fileDir = TILE_PATH + '/' + layer_id + '/' + z + '/' + x
                    var filePath = fileDir + '/' + y + '.pbf'
                    /* eslint-disable security/detect-non-literal-fs-filename */
                    mkdirp(fileDir, (err) => {
                      if (err) {
                        log.error(err)
                      }
                      fs.writeFile(filePath, data, (err) => {
                        if (err) {
                          log.error(err)
                        }
                      })
                    })
                    res.set(headers)
                    res.status(200).send(data)
                    resolve()
                  }
                })
              })
            }).catch((err) => {
              log.error('After Second Attempt: ' + err.message)
            })
        } else {
          log.error(err.message)
        }
      })
  }

  app.get('/tiles/layer/:layer_id(\\d+)/:z(\\d+)/:x(\\d+)/:y(\\d+).pbf', checkLogin, privateLayerCheck.middleware, (req, res) => {
    const z = parseInt(req.params.z)
    const x = parseInt(req.params.x)
    const y = parseInt(req.params.y)

    const layer_id = parseInt(req.params.layer_id)
    completeTileRequest(req, res, layer_id, z, x, y)
  })

  app.get('/tiles/lyr/:shortid/:z(\\d+)/:x(\\d+)/:y(\\d+).pbf', (req, res) => {
    var z = parseInt(req.params.z)
    var x = parseInt(req.params.x)
    var y = parseInt(req.params.y)

    var shortid = req.params.shortid

    var user_id = -1
    if (req.isAuthenticated && req.isAuthenticated() && req.session.user) {
      user_id = req.session.user.maphubsUser.id
    }

    Layer.isSharedInPublicMap(shortid)
      .then(isPublic => {
        return Layer.getLayerByShortID(shortid).then(layer => {
          if (isPublic ||
            (
              manetCheck(req, res, true) &&
              privateLayerCheck.check(layer.layer_id, user_id)
            )
          ) {
            return completeTileRequest(req, res, layer.layer_id, z, x, y)
          } else {
            return res.status(404).send()
          }
        })
      }).catch((err) => {
        log.error(err.message)
        res.status(404).send()
      })
  })
}
