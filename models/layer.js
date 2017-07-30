//@flow
var knex = require('../connection.js');
var debug = require('../services/debug')('layer');
var _find = require('lodash.find');

module.exports = {

  getLayerByID(layer_id: number) {
    debug('getting layer: ' + layer_id);

    return knex.select('layer_id', 'name', 'description', 'data_type', 'status', 'source',
                        'owned_by_group_id', 'last_updated', 'extent_bbox')
        .table('omh.layers').where('layer_id', layer_id)
      .then((result) => {
        if (result && result.length === 1) {
          return result[0];
        }
        //else
        return null;
      });
  },

  getAllLayerIDs(){
    return knex('omh.layers').select('layer_id').where({is_external: false, remote: false});
  },

  isPrivate(layer_id: number){   
  return knex.select('private').from('omh.layers').where({layer_id})
    .then((result) => {
      if (result && result.length === 1) {
        return result[0].private;
      }
      //else
      return true; //if we don't find the layer, assume it should be private
    });
  },

  getGroupMembers(group_id: string) {
    return knex.select('public.users.id', 'public.users.display_name', 'public.users.email', 'omh.group_memberships.role').from('omh.group_memberships')
      .leftJoin('public.users', 'omh.group_memberships.user_id', 'public.users.id')
      .where('omh.group_memberships.group_id', group_id);
  },

  allowedToModify(layer_id: number, user_id: number){
    var _this = this;
    if(!layer_id || user_id <= 0){
      return false;
    }
    return this.getLayerByID(layer_id)
      .then((layer)=>{
        if(layer){
          return _this.getGroupMembers(layer.owned_by_group_id)
        .then((users)=>{
          if(_find(users, {id: user_id}) !== undefined){
            return true;
          }
          return false;
        });
      }else{
        return false;
      }
    });
  }
};
