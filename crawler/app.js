var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var request = require("request");
var iconv = require('iconv-lite');
var Promise = require("bluebird");
var zlib = require('zlib');
var mongo = require('mongodb');
var monk = require('monk');

var mongoose = require('mongoose');
var EventProxy = require('eventproxy');
//var db = monk('localhost:27017/scraping');
var db = mongoose.createConnection('localhost:27017/scraping');

var index = require('./routes/index');
var users = require('./routes/users');

var async = require('async');

var charset = require('superagent-charset');
var request = require('superagent');
var cheerio = require('cheerio');

var superagent = charset(request);


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});


// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});



var mongooseSchema = new mongoose.Schema({
  title :  {type : String},
  content: {type : String},
  abstract: {type : String},
  postdate:  {type : String},
  link : {type : String, unique:true},
  date : {type : Date, default: Date.now},
  fetchsub:{type : Boolean, default: false}
});

var mongooseModel = db.model('news', mongooseSchema);

var originUrls=[
  {
    homeurl:'http://auto.qq.com',
    newsurl:'auto.qq.com/a/',
    titleId:'h1',
    contentId:'#Cnt-Main-Article-QQ',
    abstractId:'#Cnt-Main-Article-QQ p',
    dateId:'span.a_time',
    origin:'qq'
  },{
    homeurl: 'https://www.autohome.com.cn',
    newsurl: 'www.autohome.com.cn/news/',
    titleId: 'h1',
    contentId:'#articleContent',
    abstractId:'#articleContent p',
    dateId:'.article-info span:first-child',
    origin:'autohome'
  },
  {
    homeurl: 'http://news.16888.com/',
    newsurl: 'news.16888.com/a',
    titleId:'.news_title',
    contentId:'#news_content div:first-child',
    abstractId:'#news_content p',
    dateId:'.news_admin span:first-child',
    origin:'news16888'
  }]


  var currentIndex = 2;

function getUrl(){
  mongooseModel.find({'fetchsub':false, 'origin':originUrls[currentIndex].origin}, {}, {}, function(error, result){
    if(error) {
        console.log(error);
    } else {
        console.log(result.length);
        if(result.length == 0){
          fetchUrl(null,originUrls[currentIndex].homeurl);
        }else{
          mongooseModel.findOne({'fetchsub':false}, function(error, record){
            console.log(error);
            if(record){
              fetchUrl(record._id, record.link);
            }
          })
        }
    }

});

}

function fetchUrl(id,url){
  superagent.get(url)//.charset('gb2312')
  .end(function (err, res) {
    if (err) {
      return console.error('err' + err);
    }

    if(!res.text) return;
    var $ = cheerio.load(res.text);
    var suburls =[];
    $('body a').each(function (i, elem) {
      var href = $(elem).attr('href');
      if(href){
        if(href.indexOf(originUrls[currentIndex].newsurl)>-1){
          if(href.indexOf('http')==-1){
            suburls.push('https:' + href);
          }else{
            suburls.push(href);
          }
          
        } 
      }
    }); 
    console.log('suburls:' + suburls.length);
    if(!id){
      insert(suburls);
      return;
    }

   mongooseModel.findByIdAndUpdate(id,{'fetchsub':true},{}, function(){
      insert(suburls);
    })  


  }); 
}

function insert(suburls){
  var eventproxy = new EventProxy();

  eventproxy.after('master_html', suburls.length, function (pages) {
    pages = pages.map(function (pageData) {
      var pageurl = pageData[0];
      var pagetxt = pageData[1];
      var $ = cheerio.load(pagetxt);
      return ({
        title : $(originUrls[currentIndex].titleId) ? $(originUrls[currentIndex].titleId).text().trim():'',
        content:$(originUrls[currentIndex].contentId) ? $(originUrls[currentIndex].contentId).html():'' ,
        abstract:$(originUrls[currentIndex].abstractId) ? $(originUrls[currentIndex].abstractId).text().trim():'',
        postdate: $(originUrls[currentIndex].dateId) ? $(originUrls[currentIndex].dateId).text().trim():'',
        link : pageurl
      });
    });
    var batch = mongooseModel.collection.initializeOrderedBulkOp();
    for (var i = 0; i < pages.length; ++i) {
      if(pages[i].title !=''){
        var newKey = {
          "title": pages[i].title,
          "abstract": pages[i].abstract,
          "content":pages[i].content,
          "postdate": pages[i].postdate,
          "link" : pages[i].link,
          "date": new Date(),
          "fetchsub":false,
          "origin":originUrls[currentIndex].origin
        };
       
        batch.insert(newKey);
      }
    
    }
 
    // Execute the operations
    batch.execute(function(err, result) {
      console.log(err);
      getUrl();
    });
  });


  suburls.forEach(function (pageurl) {
    superagent.get(pageurl)//.charset('gb2312')
      .end(function (err, res) {
        console.log('fetch ' + pageurl + ' successful');
        
        eventproxy.emit('master_html', [pageurl, res ? res.text:'']);
      });
  });
}


getUrl();



module.exports = app;
