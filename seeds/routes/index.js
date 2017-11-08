var express = require('express');
var URL = require('url');
var router = express.Router();
var trimHtml = require('trim-html');
var ObjectID = require('mongodb').ObjectID;
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('seeds');
});


router.get('/submitSeeds', function(req, res, next){
  var seedsStr = req.query.seeds || '';
  if(seedsStr!=''){
      var db = req.db;
      var collection = db.get('unvisited');
      var seeds = seedsStr.split(',');
      for(var i =0;i<seeds.length;i++){
        collection.insert({'link':seeds[i]});
      }
  }
  res.end(JSON.stringify('success'));
})


module.exports = router;
