// @flow
var log = require('./log')
module.exports = {

  apiError (res: any, code: number) {
    return function (err: Error) {
      log.error(err)
      res.status(code).send({success: false, error: err.toString()})
    }
  },

  apiDataError (res: any, msg: string = 'Bad Request: required data not found') {
    res.status(400).send({
      success: false,
      error: msg
    })
  },

  nextError (next: Function) {
    return function (err: Error) {
      log.error(err)
      next(err)
    }
  }

}
