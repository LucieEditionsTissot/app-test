const express = require('express');
const favicon = require('serve-favicon');
const path = require('path');
require('dotenv').config();

const app = express();

const { messageHandler, jobsStatus } = require('./messageHandler');

app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public/images', 'favicon.ico')));
app.use('/coverage', express.static(path.join(__dirname, '..', 'coverage')));
app.engine('.html', require('ejs').__express);
app.set('views', path.join(__dirname, 'views'));
app.use('/js', express.static(path.join(__dirname, 'views')));
app.set('view engine', 'html');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

messageHandler();

app.get('/', (req, res) => {
  const tags = req.query.tags || '';
  const tagmode = req.query.tagmode || 'all';
  const status = req.query.status || '';

  console.log(`Route GET / accessed\nTags: ${tags}, Tagmode: ${tagmode}, Status: ${status}`);

  if (!tags) {
    console.log('No tags provided. Rendering empty page.');
    return res.render('index', {
      tagsParameter: tags,
      tagmodeParameter: tagmode,
      photos: [],
      searchResults: false,
      invalidParameters: false,
      status: status,
      downloadLink: null,
    });
  }

  const photoModel = require('./photo_model');
  photoModel.getFlickrPhotos(tags, tagmode).then((photos) => {
    const downloadLink = jobsStatus[tags];

    let finalStatus = downloadLink ? 'success' : status;

    res.render('index', {
      tagsParameter: tags,
      tagmodeParameter: tagmode,
      photos: photos.slice(0, 10),
      searchResults: true,
      invalidParameters: false,
      status: finalStatus,
      downloadLink: downloadLink || null,
    });

    console.log(`Photos retrieved for tags: ${tags}. Download link: ${downloadLink || 'none'}`);
  }).catch((error) => {
    res.status(500).send(`Error fetching photos: ${error.message}`);
  });
});



const zipRoute = require('./zipRoute');
app.use(zipRoute);

require('./route')(app);

const port = process.env.PORT || 3000;
app.server = app.listen(port, () => {
  console.log(`listening on port ${port}`);
});

module.exports = app;
