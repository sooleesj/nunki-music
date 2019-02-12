// Paul Robinson, Soo Lee, Michael Truong
// CS467 - Capstone - Winter 2019
// Nunki Music App


const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// used for google upload example (GUE)
// https://github.com/GoogleCloudPlatform/nodejs-docs-samples/blob/3bb14ef7c23305613bbfe04f03d3b83f6a120e1a/appengine/storage/standard/app.js
const format = require('util').format;
const Multer = require('multer'); // multer is used for file uploads
const process = require('process');
const path = require('path');

const mp3Duration = require('mp3-duration'); // get length of mp3 in ms
const getMP3Duration = require('get-mp3-duration'); // get length of mp3 in ms

// not used at the moment
const request = require('request');
const rp = require('request-promise');
const fs = require('fs');
const http = require('http');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

const {Datastore} = require('@google-cloud/datastore');
const {Storage} = require('@google-cloud/storage');

// defines max file size for upload
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // no larger than 5mb, change as needed
  }
});




// Instantiate a datastore client
const datastore = new Datastore();
// create a storage client 
const storage = new Storage();

// name the buckets we're using
const imageBucketName = 'album-images-nunki-music';
const imageBucket = storage.bucket(imageBucketName);
const songBucketName = 'song-files-nunki-music';
const songBucket = storage.bucket(songBucketName);

const BASEURL = "https://nunki-music.appspot.com";


/***************************************************************************
****************************************************************************
  START HTTP Actions
****************************************************************************
***************************************************************************/

//***************************************************************************
// START Upload a Song
// Requires: 
//***************************************************************************

function postSong(song) {
  const key = datastore.key('song');
  return datastore.save({"key": key, "data": song})
  .then(() => {return key})
  // get the key back from the first save, use it in the self link and resave
  .then ( (result) => {
    song.self = (BASEURL + "/songs/" + key.id);
    return datastore.save({"key": key, "data": song})
  }).then(() => {return key});
}

/*
function mp3Duration(songBuffer, function (err, duration) {
  if (err) return console.log(err.message);
  return duration;
});

function getSongDuration(songBuffer){
  console.log("gsd1");
  mp3Duration(songBuffer, function (err, duration) {
    if (err) return console.log(err.message);
    console.log("duration is");
    console.log(duration);
    return new Promise((resolve, reject) => {
      return duration;
    });
}
*/

/*
  .then((duration) => {
    if (err){
      console.log("gsd err");
      console.log(err.message);
      throw err;
    }
    else {
      console.log("gsd2");
      console.log("here's duration");
      console.log(duration);
      return duration;
    }
  });
}
*/

// takes a bucket name, such as songBucket, and the file object

function saveFileToBucket(bucket, newFile){
  const blob = bucket.file(newFile.originalname);
  const blobStream = blob.createWriteStream({
    resumable: false
  });

  return new Promise(function(resolve, reject) {

    blobStream.on('error', (err)=>{
      console.log(err.message);
      next(err);
    });

    var publicUrl = "placeholder";
    blobStream.on('finish', ()=>{
      const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
      console.log("in finish");
      console.log(publicUrl);
      resolve(publicUrl);
    });

    blobStream.end(newFile.buffer);

    console.log("after finish");
    console.log(publicUrl);

    //resolve(publicUrl);
  });
}
async function makePublic(bucketName, filename) {

  // Makes the file public
  await storage
    .bucket(bucketName)
    .file(filename)
    .makePublic();

  console.log(`gs://${bucketName}/${filename} is now public.`);
}

/*******************************
/ POST method
/******************************/

app.post('/songs', multer.fields([{ name: 'artwork', maxCount: 1},
                                  { name: 'source', maxCount: 1}]),
                                (req, res) => {

  var song = {"name": req.body.name, 
              "artist": req.body.artist,
              "album": req.body.album};

  song.duration = getMP3Duration(req.files.source[0].buffer);

  //saveFileToBucket(songBucket, req.source).then((songUrl) => {

    
    console.log("postsong1");
  return saveFileToBucket(songBucket, req.files.source[0]).then((url)=>{
    song.source = url;


    console.log("song after source save");
    console.log(song);


    return;
  }).then(() => {
    return makePublic(songBucketName, req.files.source[0].originalname)
  }).then(() => {
    return saveFileToBucket(imageBucket, req.files.artwork[0])


  }).then((url2)=>{
    song.artwork = url2;
    console.log("song after image save");
    console.log(song);
    return;
  }).then(() => {
    return makePublic(imageBucketName, req.files.artwork[0].originalname)
  }).then(() => {

  
    return postSong(song);
  }).then(result => {
    song.id = result.id;
    res
      .status(201)
      .json(song)
      .end();
  }).catch( (err) => {



    res
      .status(500)
      .send('500 - Unknown Post Song Error')
      .end()
  });
});






/*app.post('/upload', multer.single('file'), (req, res, next) => {
  if (!req.file) {
    res.status(400).send('No file uploaded.');
    return;
  }

  // Create a new blob in the bucket and upload the file data.
  const blob = bucket.file(req.file.originalname);
  const blobStream = blob.createWriteStream({
    resumable: false
  });

  blobStream.on('error', (err) => {
    next(err);
  });

  blobStream.on('finish', () => {
    // The public URL can be used to directly access the file via HTTP.
    const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
    res.status(200).send(publicUrl);
  });

  blobStream.end(req.file.buffer);
});

*/
// END Upload a Song
//***************************************************************************


// TODO rewrite to use datastore instead of buckets
//***************************************************************************
// START List all songs in a Bucket
//***************************************************************************
// Helper function
// Takes a bucket name
// Returns json of all files in that bucket

/*


async function listFiles(bucketName) {

  // Lists files in the bucket
  const [files] = await storage.bucket(bucketName).getFiles();

//  console.log('Files:');
//  files.forEach(file => {
//    console.log(file.name);
//  });
  return files
}

// get a list of songs on the server
// uses const global name of bucketName for now

app.get('/songs/', (req, res) => {
  const songs = listFiles(bucketName)
    .then((songs) => {
      //console.log(songs)
      res
        .status(200)
        .json(songs);
    }).catch(function(error) {
      console.log(error);
      res
        .status(500)
        .send({error:"500 - Unknown Get Songs Error"});
    });
});


*/

// END List Songs
//****************************************************************************









//----------------Legacy---------------//

// This is the sample that can stream directly from bucket to browser
// Don't think we need it, but keeping just in case

app.get('/test2', (req, res) => {
  var file = bucket.file('tones.mp3');

  console.log('here1');

  res.set('content-type', 'audio/mp3');
  res.set('accept-ranges', 'bytes');

  file.createReadStream()
    .on('error', function(err) {})
    .on('response', function(response) {
        })
    .on('end', function() {
        })
    .pipe(res);

  
});


//----------------Other Stuff---------------//

app.get('/', (req, res, next) => {
  console.log("the app is running");
  res.send("Nunki Music App");
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

/*
// Original for posting a file directly to a Bucket
// Process the file upload and upload to Google Cloud Storage.
app.post('/upload', multer.single('file'), (req, res, next) => {
  if (!req.file) {
    res.status(400).send('No file uploaded.');
    return;
  }

  // Create a new blob in the bucket and upload the file data.
  const blob = bucket.file(req.file.originalname);
  const blobStream = blob.createWriteStream({
    resumable: false
  });

  blobStream.on('error', (err) => {
    next(err);
  });

  blobStream.on('finish', () => {
    // The public URL can be used to directly access the file via HTTP.
    const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
    res.status(200).send(publicUrl);
  });

  blobStream.end(req.file.buffer);
});

*/
