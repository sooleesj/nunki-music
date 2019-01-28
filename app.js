// Paul Robinson
// CS493 Fall 2018
// Final Project - Users, Booklists, and Books
// Last Updated: 3-Dec-2018


const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const rp = require('request-promise');
const jwt = require('express-jwt');
const jwks = require('jwks-rsa');

// number of results per page
const PAGESIZE = 5;

const userRouter = express.Router();
const listRouter = express.Router();
const bookRouter = express.Router();

const app = express();
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

const Datastore = require('@google-cloud/datastore');

// Instantiate a datastore client
const datastore = Datastore();

const auth0ClientId = "tY7ZJoZejj7NW9o2PSpl1pkCiS4AKa2N";
const auth0ClientSecret = "qIjKaLf_plEPVj4UivkM8jYzFJU2kwZi0QeG3ptlRPpFdhEVFIXVNFjWxXmKcm5m";

const managementClientId = "tAtZxOSmJN3nbJ7EOR6uPYXSrpbqxTwO";
const managementClientSecret = "zLgIvMSp0P3fNy6F7u4dcA6MMbFIH6Uut9KYGJukITY1u3KOWatoQl1XjYYNfpxi";

// Helper Functions

// used to get all info about an entity
function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

// verify a provided jwt is good
const jwtCheck = jwt({
    secret: jwks.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: "https://pacrob.auth0.com/.well-known/jwks.json"
    }),
    issuer: "https://pacrob.auth0.com/",
    algorithms: ['RS256']
});

function getTodaysDate() {
  // date code from https://stackoverflow.com/questions/1531093/how-do-i-get-the-current-date-in-javascript
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth()+1; //January is 0!
  var yyyy = today.getFullYear();
  if(dd<10) {
      dd = '0'+dd
  }
  if(mm<10) {
      mm = '0'+mm
  }
  today = mm + '/' + dd + '/' + yyyy;
  return today;
}

const BASEURL = "https://pacrob-booklist.appspot.com";

//-----------------Datastore interaction functions------------------//
//---USERS

async function userSearch(userId) {
  const userKey = datastore.key(['user', parseInt(userId,10)]);
  const query = datastore.createQuery('user').filter('__key__', '=', userKey);
  return datastore.runQuery(query);
}

async function validateUser(userId) {
  const userKey = datastore.key(['user', parseInt(userId,10)]);
  return userSearch(userId).then (results => {
    if (results[0].length > 0) {
      console.log("userSearch results len > 0");
      const query = datastore.createQuery('user').filter('__key__', '=', userKey);
      return datastore.runQuery(query);
    }
    else {
      console.log("userSearch results len not > 0");
      var e = new Error;
      e.name = 'InvalidUserIdError';
      throw e;
    };
  });
}
function postUser(user) {
  const key = datastore.key('user');
  return datastore.save({"key": key, "data": user})
  .then(() => {return key})
  // get the key back from the first save, use it in the self link and resave
  .then ( (result) => {
    user.self = (BASEURL + "/users/" + key.id);
    user.joined = getTodaysDate();
    return datastore.save({"key": key, "data": user})
  }).then(() => {return key});
    
}

// Takes a userName and a userId 
// Verifies that they are the same user
// returns nothing if so, throws error if not
function verifyUser(userName, userId){
  const userKey = datastore.key(['user', parseInt(userId,10)]);
  return validateUser(userId).then ((results) => {
    if (userName === results[0][0].email) {
      return;
    }
    else {
      var e = new Error;
      e.name = 'ForbiddenUserError';
      throw e;
    }
  });
}

function getUserById(userId){
  return validateUser(userId).then((entities) => {
    return entities[0].map(fromDatastore);
  }).catch((error) => {
    console.log("error in getUserById");
    console.log(error);
    throw error;
  });
}
function updateUser(userId, fname, lname){
  const userKey = datastore.key(['user', parseInt(userId,10)]);
  return validateUser(userId).then((results) => {
    var updatedUser = results[0][0];
    updatedUser.fname = fname;
    updatedUser.lname = lname;
    return datastore.update({"key": userKey, "data": updatedUser});
  }).catch(function(error) {
    if (error.name == 'InvalidUserIdError') {
      throw error;
    }
    else {
      console.log(error);
      throw error;
    }
  });
}
//---LISTS
async function listSearch(listId) {
  const listKey = datastore.key(['list', parseInt(listId,10)]);
  const query = datastore.createQuery('list').filter('__key__', '=', listKey);
  return datastore.runQuery(query);
}

async function validateList(listId) {
  const listKey = datastore.key(['list', parseInt(listId,10)]);
  return listSearch(listId).then (results => {
    if (results[0].length > 0) {
      console.log("listSearch results len > 0");
      const query = datastore.createQuery('list').filter('__key__', '=', listKey);
      return datastore.runQuery(query);
    }
    else {
      console.log("listSearch results len not > 0");
      var e = new Error;
      e.name = 'InvalidListIdError';
      throw e;
    };
  });
}
// takes: list json object with name and genre
//
// returns: a list key with the newly assigned id
function postList(list) {
  const key = datastore.key('list');
  return datastore.save({"key": key, "data": list})
  .then(() => {return key})
  // get the key back from the first save, use it in the self link and resave
  .then ( (result) => {
    list.self = (BASEURL + "/lists/" + key.id);
    list.created = getTodaysDate();
    list.books = [];
    return datastore.save({"key": key, "data": list})
  }).then(() => {return key});
    
}
function getListsUnsecure(req) {
  var q = datastore.createQuery('list').limit(PAGESIZE);
  var p = datastore.createQuery('list');
  const results = {};

  if(Object.keys(req.query).includes("cursor")){
    q = q.start(req.query.cursor);
  }
  return datastore.runQuery(q).then ( (entities) => {
    results.items = entities[0].map(fromDatastore);
    if (entities[1].moreResults !== Datastore.NO_MORE_RESULTS) {
      results.next = (BASEURL + "/lists?cursor=" + entities[1].endCursor);
    }
  }).then( () => {
    return datastore.runQuery(p);
  }).then( (entities) => {
    results.totalSearchResults = entities[0].length;
    return results;
  });
}


// returns a single list
function getListById(listId) {
  return validateList(listId).then((entities) => {
    return entities[0].map(fromDatastore);
  }).catch((error) => {
    console.log("error in getListById");
    console.log(error);
    throw error;
  });
}
function updateList(listId, name, genre){
  const listKey = datastore.key(['list', parseInt(listId,10)]);
  return validateList(listId).then((results) => {
    var updatedList = results[0][0];
    updatedList.name = name;
    updatedList.genre = genre;
    return datastore.update({"key": listKey, "data": updatedList});
  }).catch(function(error) {
    if (error.name == 'InvalidListIdError') {
      throw error;
    }
    else {
      console.log(error);
      throw error;
    }
  });
}
function deleteList(listId){
  const listKey = datastore.key(['list', parseInt(listId,10)]);
  return validateList(listId).then((results) => {
    return datastore.delete(listKey);
  }).catch(function(error) {
    if (error.name == 'InvalidListIdError') {
      throw error;
    }
    else {
      console.log(error);
      throw error;
    }
  });
}
//---BOOKS
async function bookSearch(bookId) {
  const bookKey = datastore.key(['book', parseInt(bookId,10)]);
  const query = datastore.createQuery('book').filter('__key__', '=', bookKey);
  return datastore.runQuery(query);
}

async function validateBook(bookId) {
  const bookKey = datastore.key(['book', parseInt(bookId,10)]);
  return bookSearch(bookId).then (results => {
    if (results[0].length > 0) {
      console.log("bookSearch results len > 0");
      const query = datastore.createQuery('book').filter('__key__', '=', bookKey);
      return datastore.runQuery(query);
    }
    else {
      console.log("bookSearch results len not > 0");
      var e = new Error;
      e.name = 'InvalidBookIdError';
      throw e;
    };
  });
}
// takes: book json object with title, author, and ISBN
//
// returns: a book key with the newly assigned id
function postBook(book) {
  const key = datastore.key('book');
  return datastore.save({"key": key, "data": book})
  .then(() => {return key})
  // get the key back from the first save, use it in the self link and resave
  .then ( (result) => {
    book.self = (BASEURL + "/books/" + key.id);
    return datastore.save({"key": key, "data": book})
  }).then(() => {return key});
    
}

// returns all books
function getBooks(req) {
  // first query to get book info to displey
  var q = datastore.createQuery('book').limit(PAGESIZE);
  // second query to get total count of search results available
  var p = datastore.createQuery('book');
  const results = {};
  if(Object.keys(req.query).includes("cursor")){
    q = q.start(req.query.cursor);
  }
  return datastore.runQuery(q).then ( (entities) => {
    results.items = entities[0].map(fromDatastore);
    if (entities[1].moreResults !== Datastore.NO_MORE_RESULTS) {
      results.next = (BASEURL + "/books?cursor=" + entities[1].endCursor);
    }
  }).then( () => {
    return datastore.runQuery(p);
  }).then( (entities) => {
    results.totalSearchResults = entities[0].length;
    console.log("after query entities");
    console.log(entities);
    return results;
  });
}

// returns a single book
function getBookById(bookId) {
  return validateBook(bookId).then((entities) => {
    return entities[0].map(fromDatastore);
  }).catch((error) => {
    console.log("error in getBookById");
    console.log(error);
    throw error;
  });
}

function updateBook(bookId, author, ISBN){
  const bookKey = datastore.key(['book', parseInt(bookId,10)]);
  return validateBook(bookId).then((results) => {
    var updatedBook = results[0][0];
    updatedBook.author = author;
    updatedBook.ISBN = ISBN;
    return datastore.update({"key": bookKey, "data": updatedBook});
  }).catch(function(error) {
    if (error.name == 'InvalidBookIdError') {
      throw error;
    }
    else {
      console.log(error);
      throw error;
    }
  });
}


// deletes book from lists that it is on
function deleteBook(bookId){
  const bookKey = datastore.key(['book', parseInt(bookId,10)]);
  return validateBook(bookId).then((results) => {


    var p = datastore.createQuery('list');
    return datastore.runQuery(p);
  }).then((results) => {
    var lists = results[0];
    console.log("here you go");
    var listsThatContainBook = [];
    
    for (var i = 0; i < lists.length; i++){
      var listWithId = fromDatastore(lists[i]);
      for (var j = 0; j < listWithId.books.length; j++){
        if (listWithId.books[j].bookId == bookId) {
          listsThatContainBook.push(listWithId.id);
        }
      }
    }
      
    console.log(listsThatContainBook);
    var promisesToDelete = [];
    for (var k = 0; k < listsThatContainBook.length; k++){
      var newP = deleteBookFromList(bookId, listsThatContainBook[k]);
      promisesToDelete.push(newP);
    }

    Promise.all(promisesToDelete);
  }).then(function(values) {

    return;

  }).then(() => {
    return datastore.delete(bookKey);
  }).catch(function(error) {
    if (error.name == 'InvalidBookIdError') {
      throw error;
    }
    else {
      console.log(error);
      throw error;
    }
  });
}
//---BOOKS and LISTS

function addBookToList(bookId, listId) {
  const listKey = datastore.key(['list', parseInt(listId,10)]);
  bookObj = {};

  return validateBook(bookId).then((results) => {
    bookObj.bookId = bookId;
    bookObj.title = results[0][0].title;
    bookObj.self = results[0][0].self;
    return validateList(listId);
  }).then((results) => {
    console.log("this is bookObj");
    console.log(bookObj);
    var listToAppendTo = results[0][0];

    listToAppendTo.books.push(bookObj);
    console.log("this is listToAppendTo after push");
    console.log(listToAppendTo);
    return datastore.update({"key": listKey, "data": listToAppendTo});
  }).catch(function(error) {
    if (error.name == 'InvalidListIdError') {
      throw error;
    }
    else if (error.name == 'InvalidBookIdError') {
      throw error;
    }
    else {
      var e = new Error;
      e.name = 'UnknownAddBookToListError';
      throw e;
    }
  });
}

function deleteBookFromList(bookId, listId) {
  const listKey = datastore.key(['list', parseInt(listId,10)]);

  return validateBook(bookId).then(() => {
    return validateList(listId);
  }).then((results) => {
    //make a copy of the retrieved list
    var bookListObj = results[0][0];
    //filter a copy of its book list minus the book to delete
    var bookListArray = results[0][0].books.filter(function(el)
                                                    {return el.bookId != bookId;});
    bookListObj.books = bookListArray;

    return datastore.update({"key": listKey, "data": bookListObj});
  }).catch(function(error) {
    if (error.name == 'InvalidListIdError') {
      throw error;
    }
    else if (error.name == 'InvalidBookIdError') {
      throw error;
    }
    else {
      var e = new Error;
      e.name = 'UnknownDeleteBookFromListError';
      throw e;
    }
  });
}
// Takes a userName and a list
// Verifies that user owns the list
// returns nothing if so, throws error if not
function verifyUserOwnsList(userName, listId){
  const listKey = datastore.key(['list', parseInt(listId,10)]);
  return validateList(listId).then ((results) => {
    if (userName === results[0][0].owner) {
      return;
    }
    else {
      var e = new Error;
      e.name = 'ForbiddenUserError';
      throw e;
    }
  });
}

function isBookInList(bookId, listId) {
  const listKey = datastore.key(['list', parseInt(listId,10)]);

  return validateBook(bookId).then(() => {
    return validateList(listId);
  }).then((results) => {
    var bookListArray = results[0][0].books;
    for (var i = 0; i < bookListArray.length; ++i){
      if (bookListArray[i].bookId == bookId) {
        return true;
      }
    }
    return false;
  });
}
    

//-----------------HTTP verb functions------------------//
//---USERS

// Create a new user from an email, a password, fname, and lname
// returns all info about newly created user
app.post('/users', function(req, res){
  const useremail = req.body.email;
  const password = req.body.password;
  const fname = req.body.fname;
  const lname = req.body.lname;

  // first call uses management id and secret to obtain the access token
  // needed to create a new user
  var newUser = { "email": useremail, "fname": fname, "lname": lname};
  var options = { method: 'POST',
                  url: 'https://pacrob.auth0.com/oauth/token',
                  headers: { 'content-type': 'application/json' },
                  body: { "client_id": managementClientId, 
                          "client_secret": managementClientSecret, 
                          "audience": "https://pacrob.auth0.com/api/v2/",
                          "grant_type": "client_credentials" }, 
                  json: true };

  rp(options).then(function (parsedBody) {
    return parsedBody;
  }).then( (parsedBody) => {

    // second call takes token_type and access_token and uses them to 
    // create a new user from the original email and password provided
    options = { method: 'POST',
                url: 'https://pacrob.auth0.com/api/v2/users',
                headers: { "content-type": "application/json",
                           "authorization": parsedBody.token_type + " " + 
                                            parsedBody.access_token},
                  body: { "email": useremail,
                          "password": password,
                          "connection": "Username-Password-Authentication"
                        }, 
                  json: true };
    return rp(options);
  }).then( (result) => {
    return postUser(newUser);
  }).then((result) => {
    newUser.id = result.id
    // sends back all info about the newly created user
    res
      .status(201)
      .json(newUser)
      .end();
  }).catch(function (err) {
    res.type('plain/text');
    res.status(500);
    res.send('500 post user bork');
    });

});

// login an existing user
app.post('/users/login', function(req, res){
  const email = req.body.username;
  const password = req.body.password;
  // first call gets an access token and token type to use for logging in
  var options = { method: 'POST',
                  url: 'https://pacrob.auth0.com/oauth/token',
                  headers: { 'content-type': 'application/json' },
                  body: { "scope": "openid",
                          "client_id": auth0ClientId, 
                          "client_secret": auth0ClientSecret, 
                          "audience": "https://pacrob-authships.appspot.com/user/login",
                          "username": email,
                          "password": password,
                          "grant_type": "password" }, 
                  json: true };
  
  console.log("is options");
  console.log(options);

  return rp(options).then( (parsedBody) => {
    console.log("made step one");
    console.log(parsedBody);
    return parsedBody;
  }).then( (result) => {
    console.log("made step two");
    console.log(result);

    res.send(result);
  }).catch(function (err) {
    res.type('plain/text');
    res.status(500);
    res.send('500 log user in bork');
    });
});

// get a user information by id
app.get('/users/:userId', jwtCheck, (req, res) => {
  return verifyUser(req.user.name, req.params.userId).then(() => {
    return getUserById(req.params.userId);
  }).then((user) => {
      res
        .status(200)
        .json(user);
    }).catch(function(error) {
      if (error.name == 'InvalidUserIdError') {
        res
          .status(404)
          .send({error:"404 - No user found with this Id"});
      }
      if (error.name == 'ForbiddenUserError') {
        res
          .status(403)
          .send({error:"403 - Access to user is forbidden"});
      }
      else {
        console.log(error);
        res
          .status(500)
          .send({error:"500 - Unknown Get List By Id Error"});
      }
    });
});

// update user's fname and lname
app.put('/users/:userId', jwtCheck, (req, res) => {
  return verifyUser(req.user.name, req.params.userId).then(() => {
    return updateUser(req.params.userId, req.body.fname, req.body.lname);
  }).then(() => {
    return getUserById(req.params.userId);
  }).then((updatedUser) => {
      res
        .status(200)
        .json(updatedUser);
    }).catch(function(error) {
      if (error.name == 'InvalidUserIdError') {
        res
          .status(404)
          .send({error:"404 - No user found with this Id"});
      }
      if (error.name == 'ForbiddenUserError') {
        res
          .status(403)
          .send({error:"403 - Access to user is forbidden"});
      }
      else {
        console.log(error);
        res
          .status(500)
          .send({error:"500 - Unknown Update User Error"});
      }
    });
});
//---LISTS
// post a completely new list - id will be automatically assigned
app.post('/lists', jwtCheck, (req, res) => {
  var list = {"name": req.body.name, 
          "genre": req.body.genre,
          "owner": req.user.name};
  
  return postList(list).then(result => {
    list.id = result.id;
    res
      .status(201)
      .json(list)
      .end();
  }).catch( (err) => {
    res
      .status(401)
      .send('401 - Not Authorized')
      .end()
  });
});

// get all existing lists
app.get('/lists', (req, res) => {
  const lists = getListsUnsecure(req)
    .then((lists) => {
      const accepts = req.accepts(['application/json']);
      if(!accepts) {
        res
          .status(406)
          .send({ error:"Not Acceptable - must accept application/json"});
      }
      else {
        console.log(lists);
        res
          .status(200)
          .json(lists);
      }
    });
});

// can't put to all lists 
app.put('/lists', (req, res) => {
    res
      .status(405)
      .set("Allow", "GET, POST")
      .send({error: "Method Not Allowed"});
    
});
// can't delete to lists
app.delete('/lists', (req, res) => {
    res
      .status(405)
      .set("Allow", "GET, POST")
      .send({error: "Method Not Allowed"});
});
// get a single list by its Id
// allowed for all users
app.get('/lists/:listId', (req, res) => {
  const list = getListById(req.params.listId)
    .then((list) => {
      res
        .status(200)
        .json(list);
    }).catch(function(error) {
      if (error.name == 'InvalidListIdError') {
        res
          .status(404)
          .send({error:"404 - No list found with this Id"});
      }
      else {
        console.log(error);
        res
          .status(500)
          .send({error:"500 - Unknown Get List By Id Error"});
      }
    });
});
// update a list genre and title
app.put('/lists/:listId', jwtCheck, (req, res) => {
  
  return verifyUserOwnsList(req.user.name, req.params.listId).then(() => {
    return updateList(req.params.listId, req.body.name, req.body.genre);
  }).then(() => {
    return getListById(req.params.listId);
  }).then((list) => {
      res
        .status(200)
        .json(list);
    }).catch(function(error) {
      if (error.name == 'InvalidListIdError') {
        res
          .status(404)
          .send({error:"404 - No list found with this Id"});
      }
      else if (error.name == 'ForbiddenUserError') {
        res
          .status(403)
          .send({error:"403 - User does not have access to list"});
      }
      else {
        console.log(error);
        res
          .status(500)
          .send({error:"500 - Unknown Get List By Id Error"});
      }
    });
});
// delete a single list by its Id
app.delete('/lists/:listId', jwtCheck, (req, res) => {
  return verifyUserOwnsList(req.user.name, req.params.listId).then(() => {
    return deleteList(req.params.listId);
  }).then((result) => {
      res
        .status(204)
        .end();
    }).catch(function(error) {
      if (error.name == 'InvalidListIdError') {
        res
          .status(404)
          .send({error:"404 - No list found with this Id"});
      }
      else if (error.name == 'ForbiddenUserError') {
        res
          .status(403)
          .send({error:"403 - User does not have access to list"});
      }
      else {
        console.log(error);
        res
          .status(500)
          .send({error:"500 - Unknown Delete List By Id Error"});
      }
    });
});
//---BOOKS

// post a completely new book- id will be automatically assigned
app.post('/books', (req, res) => {
  var book = {"title": req.body.title, 
          "author": req.body.author,
          "ISBN": req.body.ISBN};
  
  return postBook(book).then(result => {
    book.id = result.id;
    res
      .status(201)
      .json(book)
      .end();
  }).catch( (err) => {
    res
      .status(500)
      .send('500 - Unknown Post Book Error')
      .end()
  });
});

// get all existing books
app.get('/books', (req, res) => {
  const books = getBooks(req)
    .then((books) => {
      const accepts = req.accepts(['application/json']);
      if(!accepts) {
        res
          .status(406)
          .send({ error:"Not Acceptable - must accept application/json"});
      }
      else {
        console.log(books);
        res
          .status(200)
          .json(books);
      }
    });
});
// can't put to all books
app.put('/books', (req, res) => {
    res
      .status(405)
      .set("Allow", "GET, POST")
      .send({error: "Method Not Allowed"});
    
});
// can't delete to books
app.delete('/books', (req, res) => {
    res
      .status(405)
      .set("Allow", "GET, POST")
      .send({error: "Method Not Allowed"});
});

// get a single book by its Id
app.get('/books/:bookId', (req, res) => {
  const book = getBookById(req.params.bookId)
    .then((book) => {
      res
        .status(200)
        .json(book);
    }).catch(function(error) {
      if (error.name == 'InvalidBookIdError') {
        res
          .status(404)
          .send({error:"404 - No book found with this Id"});
      }
      else {
        console.log(error);
        res
          .status(500)
          .send({error:"500 - Unknown Get Book By Id Error"});
      }
    });
});

// edit a single book by its Id
app.put('/books/:bookId', (req, res) => {
  return updateBook(req.params.bookId, req.body.author, req.body.ISBN)
  .then(() => {
    return getBookById(req.params.bookId);
  }).then((book) => {
      res
        .status(200)
        .json(book);
    }).catch(function(error) {
      if (error.name == 'InvalidBookIdError') {
        res
          .status(404)
          .send({error:"404 - No book found with this Id"});
      }
      else {
        console.log(error);
        res
          .status(500)
          .send({error:"500 - Unknown Get Book By Id Error"});
      }
    });
});
// delete a single book by its Id
app.delete('/books/:bookId', (req, res) => {
  return deleteBook(req.params.bookId)
  .then((result) => {
      res
        .status(204)
        .end();
    }).catch(function(error) {
      if (error.name == 'InvalidBookIdError') {
        res
          .status(404)
          .send({error:"404 - No book found with this Id"});
      }
      else {
        console.log(error);
        res
          .status(500)
          .send({error:"500 - Unknown Delete Book By Id Error"});
      }
    });
});
//---BOOKS and LISTS

// Add a book to a list
app.put('/lists/:listId/books/:bookId', jwtCheck, (req, res) => {
  return verifyUserOwnsList(req.user.name, req.params.listId).then(() => {
    return isBookInList(req.params.bookId, req.params.listId);
  }).then((result) => {
    console.log("this is result of isBookInList");
    console.log(result);
    if (result == true) {
      var e = new Error;
      e.name = 'BookAlreadyInListError';
      throw e;
    }
  }).then(() => {

    return addBookToList(req.params.bookId, req.params.listId);
  }).then(() => {
      res
        .status(200)
        .send("200 - Book added to List");
    }).catch(function(error) {
      if (error.name == 'InvalidBookIdError') {
        res
          .status(404)
          .send({error:"404 - No book found with this Id"});
      }
      else if (error.name == 'InvalidListIdError') {
        res
          .status(404)
          .send({error:"404 - No list found with this Id"});
      }
      else if (error.name == 'ForbiddenUserError') {
        res
          .status(403)
          .send({error:"403 - User does not have access to list"});
      }
      else if (error.name == 'BookAlreadyInListError') {
        res
          .status(409)
          .send({error:"409 - Book already in list"});
      }
      else {
        res
          .status(500)
          .send({error:"500 - Unknown Add Book to List Error"});
      }
    });
});

// delete a book from a list
app.delete('/lists/:listId/books/:bookId', jwtCheck, (req, res) => {
  return verifyUserOwnsList(req.user.name, req.params.listId).then(() => {
    return isBookInList(req.params.bookId, req.params.listId);
  }).then((result) => {
    console.log("this is result of isBookInList");
    console.log(result);
    if (result == false) {
      var e = new Error;
      e.name = 'BookNotInListError';
      throw e;
    }
  }).then(() => {

    return deleteBookFromList(req.params.bookId, req.params.listId);
  }).then(() => {
      res
        .status(204)
        .send("204- Book deleted from List");
    }).catch(function(error) {
      if (error.name == 'InvalidBookIdError') {
        res
          .status(404)
          .send({error:"404 - No book found with this Id"});
      }
      else if (error.name == 'InvalidListIdError') {
        res
          .status(404)
          .send({error:"404 - No list found with this Id"});
      }
      else if (error.name == 'ForbiddenUserError') {
        res
          .status(403)
          .send({error:"403 - User does not have access to list"});
      }
      else if (error.name == 'BookNotInListError') {
        res
          .status(404)
          .send({error:"404 - Book not in list"});
      }
      else {
        res
          .status(500)
          .send({error:"500 - Unknown Delete Book from List Error"});
      }
    });
});


//----------------Other Stuff---------------//

app.get('/', (req, res, next) => {
  res.send("Booklists!");
});


app.use(function(req, res){
  res.status(404);
  res.send('404 - Not Found')
});



const PORT = process.env.PORT || 8080;
app.listen(process.env.PORT || 8080, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
