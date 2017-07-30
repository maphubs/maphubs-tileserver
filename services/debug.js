//@flow
var debug = require('debug');

module.exports = function(name: string){
  return debug("maphubs-tileserver:"+name);
};
