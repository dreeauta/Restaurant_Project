var Promise = require("bluebird");
var fs = require('fs-promise');

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');

const pgp = require('pg-promise') ({
  promiseLib: Promise
});
// const dbConfig = require('./db-config');
const db = pgp({
  database: 'dreea' });

const bcrypt = require('bcrypt');

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
    secret: 'whaaaaaaattttttt',
    cookie: {
      maxAge: 60000000
    }
}));

app.use(express.static('public'));

app.use(function(request,response, next) {
  response.locals.session = request.session;
  next();
});


app.get('/', function(request, res) {
  res.render('login.hbs');
});



app.post('/submit_login', function(request, response) {
  var name = request.body.username;
  var pw = request.body.password;
    db.one(`select * from reviewer where name = $1 and password = $2`,
    [name, pw])
    .then( function(result) {
      return bcrypt.compare(pw, result.pw);
    })
    .then(function(reviewer){
      if (matched) {
        request.session.loggedInUser = reviewer.name;
        request.session.reviewerID = reviewer.id;
        console.log(reviewer.id);
        response.redirect('/form');
        }
      else {
        response.redirect('/login')

      }

    })
    .catch(function(err){
      response.redirect('/');
  });
});

app.get('/signup', function(request,res){
  res.render('signup.hbs');
});


// app.post('/submit_login', function(request, response) {
//   var name = request.body.username;
//   var pw = request.body.password;
//   if (name === 'Andreea' && pw === 'Andreea') {
//     request.session.loggedInUser = name;
//     response.redirect('/form');
//   } else {
//     response.redirect('/');
//   }
// });

//make session automatically available to all hbs files

app.post('/after-signup', function(request, response, next) {
  var name = request.body.username;
  var email = request.body.email;
  var pw = request.body.password;
  bcrypt.hash(pw, 10)
    .then(function(encryptedPassword) {
      pw = encryptedPassword;
    })
    .then(function() {
      return db.none(`insert into reviewer values (default,  $1, $2, NULL , $3)`,[name, email, pw])
    })
    .then(function() {
      // request.session.loggedInUser = info.username;               //automatically logs user in
      response.redirect('/');
    })
    .catch(next);

});

app.get('/after-login', function(request, response) {
  response.render('after-login.hbs', {
    name: request.session.loggedInUser
  });
});

app.use(function authentication(request, response, next) {
  if (request.session.loggedInUser) {
    next();
  } else {
    response.send('Stop you must login! <a href="/"> login </a>');
  }
});

app.get('/logout', function(request, response) {
  request.session.loggedInUser = null;
  response.redirect('/');
});





app.get('/form', function(req, res){
  res.render('form.hbs');
});


app.get('/search-field', function(req,res, next){
  console.log('hello?');
  let term = req.query.searchTerm;
  db.any(`
    select * from restaurant
    where restaurant.name ilike '%${term}%' `)
    .then(function(results) {
      res.render('search-results.hbs', {
        results: results
      });
    })
  .catch(next);
});



app.get('/restaurant/:id', function(req,res, next){
  var param = req.params.id;
  var sql = `select * from restaurant where restaurant.id = $1`;
    console.log(sql);
    db.one(sql, param)
    .then(function(restaurant){
      var sql = `
        select  reviewer.name as reviewer_name,
          review.title,
          review.stars,
          review.review
         from reviewer
        inner join review
        on
        review.reviewer_id = reviewer.id
        inner join restaurant on
        review.restaurant_id = restaurant.id where
          restaurant.id = $1`;
      console.log(sql);
      return[restaurant, db.any(sql, param)]
        })
    .spread(function(restaurant, review) {
      res.render('restaurant.hbs', {
        restaurant: restaurant,
        review: review
      });
    })

    .catch(next);
});

app.post('/submit_review/:id', function(request, res, next){
  var restaurantId = request.params.id;
  db.none(`insert into review values
    (default,  $1, $2, $3, $4, $5)`,[request.session.reviewerID, request.body.stars, request.body.title, request.body.review, restaurantId])
    .then(function() {
      res.redirect(`/restaurant/${restaurantId}`);
      // res.redirect('/restaurant/20');

    })
  .catch(next);

});




app.listen(3000, function() {
  console.log('Listening on port 3000!');
});
