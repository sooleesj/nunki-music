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
var root = __dirname;

// not used at the moment
const request = require('request');
const rp = require('request-promise');
const fs = require('fs');
const http = require('http');

app.use(bodyParser.json());
// app.use(bodyParser.urlencoded());
app.use(express.static(path.join(root, 'public')));
app.use(express.static(path.join(root, 'bower_components')));


app.use(bodyParser.urlencoded({
  extended: true
}));


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
// const bucketName = 'nunki-music.appspot.com';
const bucketName = "nunki-bucket-test";

const bucket = storage.bucket(bucketName);

/***************************************************************************
****************************************************************************
  START HTTP Actions
****************************************************************************
***************************************************************************/

//***************************************************************************
// START Upload a Song
// Requires: File in req body, key='file', value=[attached file]
//***************************************************************************

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
// END Upload a Song
//***************************************************************************

//***************************************************************************
// START List all songs in a Bucket
//***************************************************************************
// Helper function
// Takes a bucket name
// Returns json of all files in that bucket

async function listFiles(bucketName) {

  // Lists files in the bucket
  const [files] = await storage.bucket(bucketName).getFiles();

  console.log('Files:');
  files.forEach(file => {
    console.log(file.name);
  });
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

// END List Songs
//****************************************************************************





// Format off -don't know how streaming works, placeholder for now
//****************************************************************************
// Stream a song by ID
//
//****************************************************************************


/*
async function downloadFile(srcFilename, destFilename) {
  // const srcFilename = 'Remote file to download, e.g. file.txt';
  // const destFilename = 'Local destination for file, e.g. ./local/path/to/file.txt';

  const options = {
    // The path to which the file should be downloaded, e.g. "./file.txt"
    destination: destFilename,
  };

  // Downloads the file
  await storage
    .bucket(bucketName)
    .file(srcFilename)
    .download(options);

  console.log(
    `gs://${bucketName}/${srcFilename} downloaded to ${destFilename}.`
  );
  // [END storage_download_file]
}
*/



app.get('/songs/:songName/stream', (req, res) => {
  res.set('content-type', 'audio/mp3');
  res.set('accept-ranges', 'bytes');

  console.log("streaming file named", req.params.songName);
  const file = __dirname + '/songs/' + req.params.songName;
  fs.exists(file, (exists) => {
    if (exists) {
        const rstream = fs.createReadStream(file);
        rstream.pipe(res);
    } else {
        res.send('Error song not found - 404');
        res.end();
    }
  });
});
    





/*
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
*/


app.get('/test2', (req, res) => {
  // var file = bucket.file('tones.mp3');
  var file = bucket.file("bensound-jazzyfrenchy.mp3");

  console.log('test2');
  console.log(file.storage.baseUrl);

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

app.get('/test', (req, res) => {
  var file = bucket.file('tones.mp3');

  console.log('here1');

  
  file.get(function(err, file, apiResponse){
      });

  console.log('here2');
  file.get().then(function(data) {
      var file = data[0];
      var apiResponse = data[1];
  }).then( (file) => {
    console.log('file exists!');
    res.set('content-type', 'audio/mp3');
    res.set('accept-ranges', 'bytes');
    const rstream = fs.createReadStream(file);
    rstream.pipe(res);
    }).catch(function (err) {
      res.type('plain/text');
      res.status(500);
      res.send('500 stream test bork');
      });
});


//----------------Other Stuff---------------//

app.get('/', (req, res, next) => {
  console.log("the app is running");
  res.render("public/index.html");
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
