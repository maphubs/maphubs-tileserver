module.exports = function(app) {
 app.get('/tiles/layer/:layer_id(\\d+)/index.json', function(req, res) {
   var layer_id = req.params.layer_id;
    res.redirect('/api/layer/' + layer_id + '/tile.json');
  });
};