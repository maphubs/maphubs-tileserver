// @flow
var Layer = require('../models/layer')
var log = require('./log')
var nextError = require('./error-response').nextError
var apiDataError = require('./error-response').apiDataError

var check = function (layer_id: number, user_id: number) {
  return Layer.isPrivate(layer_id)
    .then((isPrivate) => {
      if (isPrivate) {
        if (user_id <= 0) {
          return false
        } else {
          return Layer.allowedToModify(layer_id, user_id)
        }
      } else {
        return true
      }
    })
}

var middleware = function (view) {
  return function (req: any, res: any, next: Function) {
    var user_id = -1
    if (req.isAuthenticated && req.isAuthenticated() && req.session.user) {
      user_id = req.session.user.maphubsUser.id
    }
    var layer_id
    if (req.params.layer_id) {
      layer_id = parseInt(req.params.layer_id || '', 10)
    } else if (req.body.layer_id) {
      layer_id = req.body.layer_id
    } else if (req.params.id) {
      layer_id = parseInt(req.params.id || '', 10)
    } else {
      apiDataError(res, 'Unable to determine layer_id')
    }

    if (layer_id && Number.isInteger(layer_id) && layer_id > 0) {
      check(layer_id, user_id)
        .then((allowed) => {
          if (allowed) {
            next()
            return null
          } else {
            log.warn('Unauthorized attempt to access layer: ' + layer_id)
            if (view) {
              return res.redirect('/unauthorized')
            } else {
              return res.status(401).send({
                success: false,
                error: 'Unauthorized'
              })
            }
          }
        }).catch(nextError(next))
    } else {
      apiDataError(res, 'missing or invalid layer id')
    }
  }
}

module.exports = {
  check,
  middlewareView: middleware(true),
  middleware: middleware(false)
}
