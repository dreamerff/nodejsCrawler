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
mongoose.Promise = global.Promise;
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
  pagetitle :  {type : String},
  keyword:{type : String},
  description: {type : String},
  pagecontent: {type : String},
  html:  {type : String},
  link : {type : String, unique:true},
  date : {type : Date, default: Date.now},
  fetchsub:{type : Boolean, default: false},
  source:{type:String}
});

var visitedSchema = new mongoose.Schema({ // 存储已访问过的链接
  link:{type:String}
});
var unVisitedSchema = new mongoose.Schema({ // 存储待访问的链接
  link:{type:String}
});

var mongooseModel = db.model('mongooseModel', mongooseSchema, 'crawlerdata');
var visitedModel = db.model('visitedModel', visitedSchema,'visited');
var unVisitedModel = db.model('unVisitedModel', unVisitedSchema,'unvisited');


var symbolReg = /[\ |\~|\`|\!|\@|\#|\$|\%|\^|\&|\*|\(|\)|\-|\_|\+|\=|\||\\|\[|\]|\{|\}|\;|\:|\"|\'|\，|\,|\。|\<|\.|\>|\/|\?]/g;
var chineseReg = /[^\u4e00-\u9fa5]/g;
var regURL = /^http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- ./?%&=]*)?$/;

// 爬取当前页面
function crawling(){
  unVisitedModel.findOne({'link':regURL}, function(error, record){  // 从数据库中读取unvisited 链接

     if(record){ // 如果数据库中有unvisited链接,则去爬当前页
      superagent.get(record.link).end(function (err, res) {

        unVisitedModel.remove({'link': record.link}, function(err, docs){
          if(err) console.log(err);
        })

        if (err) {
          crawling();
          return console.error('err' + err);
        } 
        var newLink = new visitedModel({
          "link":record.link
        })
        newLink.save( function(err, docs){
          if(err) console.log(err);
        })
        if(!res.text) {
            crawling();
        }else{
            getPageData(res,record.link);
        }
      });
    } 
  });
}
// 获取页面信息及子链接
function getPageData(res, pageurl){
  var $ = cheerio.load(res.text);

  // 存储未爬取的链接
  $('body a').each(function (i, elem) {
    var href = $(elem).attr('href');
    if(href){
        if(href.indexOf('http')>-1 || href.indexOf('https') > -1){
          visitedModel.findOne({'link':'http://www.sina.com.cn/'}, function(error, record){
            if(!record){
              var newLink = new unVisitedModel({
                'link': href
              })
              newLink.save(function(err, docs){
                if(err) console.log(err);
              })
            }
          });
         
        }
    }
  }); 

   
    // 存储页面信息
    var keyword = '',
    description = '',
    content = '',
    html ='';
  
    var title = $('title') ? $('title').text().trim().replace(symbolReg,''):'';
    if($('meta[name="keywords"]')){
      keyword = $('meta[name="keywords"]').attr('content') ? $('meta[name="keywords"]').attr('content').toString().trim().replace(symbolReg,' '):'';
    }

    if($('meta[name="description"]')){
      description = $('meta[name="description"]').attr('content') ? $('meta[name="description"]').attr('content').toString().trim().replace(symbolReg,' '):'';
    }
    
    content = $('html').text().replace(chineseReg,'');
    html =  $('html').html() ;

    var newKey = new mongooseModel({
            "pagetitle":  title,
            "keyword": keyword,
            "description": description,
            "pagecontent": content,
            "html": html,
            "link" : pageurl,
            "date": new Date()
    })

    newKey.save(function(err,res){ 
      if(!err){
        console.log('insert:' + pageurl);
      } 
      pageurl = null;
      crawling();
    }) 
}

crawling();

module.exports = app;
