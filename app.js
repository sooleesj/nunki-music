// Paul Robinson, Soo Lee, Michael Truong
// CS467 - Capstone - Winter 2019
// Nunki Music App


const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// used for google upload example (GUE)
// https://github.com/GoogleCloudPlatform/nodejs-docs-samples/blob/3bb14ef7c23305613bbfe04f03d3b83f6a120e1a/appengine/storage/standard/app.js
const format = require('util').format;
const Multer = require('multer');
const process = require('process');

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

// used for GUE
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

// name the bucket we're using
const bucketName = 'nunki-music.appspot.com';

const bucket = storage.bucket(bucketName);


async function listFiles(bucketName) {
  // [START storage_list_files]

  // Lists files in the bucket
  const [files] = await storage.bucket(bucketName).getFiles();

  console.log('Files:');
  files.forEach(file => {
    console.log(file.name);
  });
  return files
  // [END storage_list_files]
}

// Helper Functions

// used to get all info about an entity
function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

const BASEURL = "https://nunki-music.appspot.com";

//-----------------Datastore interaction functions------------------//
//---Song

//************************************************************
// Get list of files currently in a particular bucket
//************************************************************

async function listFiles(bucketName) {
  // [START storage_list_files]

  // Lists files in the bucket
  const [files] = await storage.bucket(bucketName).getFiles();

  console.log('Files:');
  files.forEach(file => {
    console.log(file.name);
  });
  return files
  // [END storage_list_files]
}

// Helper Functions

// used to get all info about an entity
function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}


function postSong(song) {
}


function streamSong(songID) {
}




//-----------------HTTP actions----------------------------//
//---Song

// post (upload) a song - id will be automatically assigned
app.post('/songs', (req, res) => {

  // file field in song is just placeholder for now, don't know how it works
  var song = {"name": req.body.name, 
          "artist": req.body.artist,
          "file": req.body.file};
  
  return postSong(song).then(result => {
    song.id = result.id;
    res
      .status(201)
      .json(song)
      .end();
  }).catch( (err) => {
    res
      .status(500)
      .send('500 - Unknown Upload Song Error')
      .end()
  });
});

//***************************************************************************
// File Upload
//***************************************************************************

// begin GUE
// [START process]
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
// [END process]
// END File Upload
//***************************************************************************



//***************************************************************************
// List all songs in the Bucket
//***************************************************************************
// get a list of songs on the server
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

// END List Songs
//****************************************************************************





// Format off -don't know how streaming works, placeholder for now
//****************************************************************************
// Stream a song by ID
//
//****************************************************************************
app.get('/songs/stream/:songName', (req, res) => {
  //const song = streamSong(req.params.songID)
  const publicUrl = format
      ('https://storage.googleapis.com/${bucket.name}/${req.params.songName}');
  const file = fs.createWriteStream("song.mp3");

  http.get(publicUrl, response => {
      res
        .status(200)
        .pipe(file);
    }).catch(function(error) {
      if (error.name == 'InvalidSongIDError') {
        res
          .status(404)
          .send({error:"404 - No song found with this ID"});
      }
      else {
        console.log(error);
        res
          .status(500)
          .send({error:"500 - Unknown Get Song By ID Error"});
      }
    });
});


//----------------Other Stuff---------------//

app.get('/', (req, res, next) => {
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
