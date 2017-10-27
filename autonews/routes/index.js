var express = require('express');
var URL = require('url');
var router = express.Router();
var trimHtml = require('trim-html');
var ObjectID = require('mongodb').ObjectID;
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/search', function(req, res, next){
  res.render('search');
})

router.get('/searchbykey', function(req, res, next){
  var key = req.query.k || '';
  var page = req.query.page || 1;
  var limit = req.query.limit || 10;
  var db = req.db;

  var reg=new RegExp( key ,"gi");
  var collection = db.get('news');
  collection.find({'abstract': reg},{limit:limit, skip:(page-1) * limit,sort:{"postdate":-1}},function(e,docs){
      var result ={page:page,newslist:[]};

      for(var i=0; i<docs.length;i++){
      
          result.newslist.push({
             id:docs[i]._id,
             title:docs[i].title,
             abstract:docs[i].abstract,
             postdate:docs[i].postdate,
             link:docs[i].link
           })
       
      
     }  
     res.end(JSON.stringify(result));
  });
})

router.get('/detail/:id', function(req, res, next) { 
   var id = req.params.id;
   var db = req.db;
   var collection = db.get('news');


    collection.find({'_id':ObjectID(id)},{},function(e,docs){
       var obj ={
          id:docs[0]._id,
          title:docs[0].title,
          content:docs[0].content,
          postdate:docs[0].postdate,
          link:docs[0].link
       }
        res.render('detail', {
            "newsdetail" : obj
        }); 
    });
});

router.get('/newslist', function(req, res, next) {
      res.render('newslist');
 
});


router.get('/getNews', function(req, res, next) {
  var limit = req.query.limit || 10;
  var page = req.query.page || 1;
  var db = req.db;

  var collection = db.get('news');
  collection.find({},{limit:limit, skip:(page-1) * limit,sort:{"postdate":-1}},function(e,docs){
    var result ={page:page,newslist:[]};
 
       for(var i=0; i<docs.length;i++){
              result.newslist.push({
              id:docs[i]._id,
              title:docs[i].title,
              abstract:docs[i].abstract,
              postdate:docs[i].postdate,
              link:docs[i].link
            })
        
       
      }  
      res.end(JSON.stringify(result));
  });
});



module.exports = router;
