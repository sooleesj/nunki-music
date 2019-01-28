// Paul Robinson, Soo Lee, Michael Truong
// CS467 - Capstone - Winter 2019
// Nunki Music App


const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

const Datastore = require('@google-cloud/datastore');

// Instantiate a datastore client
const datastore = Datastore();


// Helper Functions

// used to get all info about an entity
function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

const BASEURL = "https://nunki-music.appspot.com";

//-----------------Datastore interaction functions------------------//
//---Song


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

// Format off -don't know how streaming works, placeholder for now
app.get('/songs/:songID', (req, res) => {
  const song = streamSong(req.params.songID)
    .then((song) => {
      res
        .status(200)
        .json(song);
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
