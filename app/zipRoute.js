const express = require('express');
const { PubSub } = require('@google-cloud/pubsub');
const { jobsStatus } = require('./messageHandler');
const router = express.Router();
require('dotenv').config();

const pubsub = new PubSub({ projectId: process.env.GOOGLE_PROJECT_ID });
const topicName = process.env.TOPIC_NAME;

router.post('/zip', async (req, res) => {
  const tags = req.body.tags;
  const tagmode = req.body.tagmode;

  if (!tags || !tagmode) {
    return res.status(400).send('Tags and tagmode are required');
  }

  try {
    const message = { tags, tagmode };
    const dataBuffer = Buffer.from(JSON.stringify(message));

    const messageId = await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
    console.log(`Message published with ID: ${messageId} for tags: ${tags}`);

    await waitForZipToBeReady(tags);

    res.redirect('/?tags=' + encodeURIComponent(tags) + '&tagmode=' + encodeURIComponent(tagmode) + '&status=success');
  } catch (error) {
    console.error(`Error publishing message: ${error.message}`);
    return res.status(500).send('Failed to send message to Pub/Sub');
  }
});

module.exports = router;


async function waitForZipToBeReady(tags) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (jobsStatus[tags]) {
        clearInterval(interval);
        resolve();
      }
    }, 2000);
  });
}

