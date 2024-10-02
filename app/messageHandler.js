const { PubSub } = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');
const ZipStream = require('zip-stream');
const fs = require('fs');
const path = require('path');
const { getFlickrPhotos } = require('./photo_model');
const got = require('got');
require('dotenv').config();

const projectId = process.env.GOOGLE_PROJECT_ID;
const subscriptionName = 'dmii2-1';
const bucketName = 'dmii2024bucket';
const pubsub = new PubSub({ projectId });
const storage = new Storage();

let jobsStatus = {};

async function messageHandler() {
  const subscription = pubsub.subscription(subscriptionName);
  console.log(`Listening for messages on subscription: ${subscriptionName}`);

  subscription.on('message', async (message) => {
    console.log("Message received");
    try {
      const { tags, tagmode } = JSON.parse(message.data.toString());
      console.log(`Message data: tags: ${tags}, tagmode: ${tagmode}`);

      const zipFilePath = await processTagsAndZipPhotos(tags, tagmode);
      console.log(`ZIP file created: ${zipFilePath}`);

      const zipFileName = path.basename(zipFilePath);
      const file = await uploadZipToGCS(zipFilePath, zipFileName);
      console.log(`ZIP file uploaded to bucket: ${file.name}`);

      const signedUrl = await generateSignedUrl(file.name);
      console.log(`Download link generated: ${signedUrl}`);

      jobsStatus[tags] = signedUrl;
      console.log(`Stored download link for tags "${tags}": ${signedUrl}`);

      message.ack();
      console.log('Message acknowledged');
    } catch (error) {
      console.error(`Error handling message: ${error.message}`);
    }
  });

  subscription.on('error', (error) => {
    console.error(`Error receiving message: ${error.message}`);
  });
}

async function processTagsAndZipPhotos(tags, tagmode) {
  try {
    const photos = await getFlickrPhotos(tags, tagmode);
    console.log(`Retrieved ${photos.length} photos for tags: ${tags}`);

    const photosToDownload = photos.slice(0, 10);
    const zipPath = await createZipStream(photosToDownload);
    console.log(`ZIP file created at: ${zipPath}`);

    return zipPath;
  } catch (error) {
    console.error(`Error processing photos: ${error.message}`);
    throw error;
  }
}

async function createZipStream(photos) {
  const zipFilePath = path.join(__dirname, 'zips', `photos_${Date.now()}.zip`);
  const output = fs.createWriteStream(zipFilePath);
  const archive = new ZipStream();

  archive.pipe(output);

  for (const photo of photos) {
    let title = photo.title.replace(/[^\w\s]/gi, '');
    if (!title.endsWith('.jpg')) {
      title += '.jpg';
    }

    const response = await got(photo.media.m, { responseType: 'buffer' });
    const contentType = response.headers['content-type'];
    console.log(`Content-Type for ${photo.title}: ${contentType}`);

    if (contentType.startsWith('image/')) {
      await new Promise((resolve, reject) => {
        archive.entry(response.body, { name: title }, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log(`Added image: ${title} to ZIP`);
            resolve();
          }
        });
      });
    }
  }


  archive.finalize();

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const fileSize = fs.statSync(zipFilePath).size;
      console.log(`ZIP file created with size: ${fileSize} bytes`);
      resolve(zipFilePath);
    });

    output.on('error', (err) => {
      reject(err);
    });
  });
}

async function uploadZipToGCS(zipFilePath, fileName) {
  const bucket = storage.bucket(bucketName);
  const [file] = await bucket.upload(zipFilePath, {
    destination: `zipsDeLucie/${fileName}`,
    resumable: false,
    metadata: { contentType: 'application/zip' },
  });
  return file;
}

async function generateSignedUrl(fileName) {
  const options = {
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60 * 48,
  };

  const [url] = await storage.bucket(bucketName).file(fileName).getSignedUrl(options);
  return url;
}

module.exports = { messageHandler, jobsStatus };
