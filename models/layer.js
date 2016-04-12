var knex = require('../connection.js');
var _find = require('lodash.find');
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
    return knex('omh.layers').select('layer_id');
  },

  getGroupMembers: function(group_id) {
    return knex.select('public.users.id', 'public.users.display_name', 'public.users.email', 'omh.group_memberships.role').from('omh.group_memberships')
      .leftJoin('public.users', 'omh.group_memberships.user_id', 'public.users.id')
      .where('omh.group_memberships.group_id', group_id);
  },

  allowedToModify: function(layer_id, user_id){
    var _this = this;
    return this.getLayerByID(layer_id)
      .then(function(layer){
           return _this.getGroupMembers(layer.owned_by_group_id)
          .then(function(users){
            if(_find(users, {id: user_id}) !== undefined){
              return true;
            }
            return false;
          });
      });
    }

};
