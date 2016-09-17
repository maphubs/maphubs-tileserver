var knex = require('../connection.js');
var debug = require('../services/debug')('layer');

module.exports = {

  getLayerByID: function(layer_id) {
    debug('getting layer: ' + layer_id);

    return knex.select('layer_id', 'name', 'description', 'data_type', 'status', 'published', 'source',
                        'license', 'is_external', 'external_layer_config', 'owned_by_group_id', 'last_updated',
                        'extent_bbox', 'preview_position')
        .table('omh.layers').where('layer_id', layer_id)
      .then(function(result) {
        if (result && result.length == 1) {
          return result[0];
        }
        //else
        return null;
      });
  },

  getAllLayerIDs: function(){
    return knex('omh.layers').select('layer_id').where({is_external: false, remote: false});
  }




};
