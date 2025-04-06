const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');  // Ensure path module is included
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const PAGE_ACCESS_TOKEN = "EAAMhcZA6vDc8BO1ZAB120AXyzrja3sjLp9WncI1jZAZAyZBsBUPv9KV20eZB3QvWbMhCZCdLLhbPuY2P5MxM9DmMBgMr7sZBQZArK5gkqLAWaGotmYAX7sQqjaXgwyWWXFfnckHaflIUlOHwnFk8dKU9N42u6aby61q5SfZC6aWhl0MNg3QO2vMhZCenQamWZAwKnzi2sQZDZD"; // Your token here
const VERIFY_TOKEN = "hello"; // Your webhook verification token
const DB_PATH = './database.json';

// Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook Event Handling
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message || event.postback) {
          console.log(event);
        }
      });
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Load and save submissions
const loadSubmissions = () => {
  if (!fs.existsSync(DB_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) || [];
  } catch (error) {
    console.error('Error loading submissions:', error);
    return [];
  }
};

const saveSubmissions = (submissions) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(submissions, null, 2));
};

// Submit a message
app.post('/submit', (req, res) => {
  const submissions = loadSubmissions();
  submissions.push(req.body);
  saveSubmissions(submissions);

  // Send back a success response to trigger SweetAlert
  res.send('Your submission has been sent for review.');
});

// Admin: Get all submissions
app.get('/admin/submissions', (req, res) => {
  const submissions = loadSubmissions();
  res.json(submissions);
});

// ✅ Fix: Serve admin.html when visiting /admin
app.get("/sslg", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "sslg.html"));
});

// Admin: Approve a submission
app.post('/admin/approve/:index', async (req, res) => {
  const submissions = loadSubmissions();
  const submission = submissions[req.params.index];

  if (!submission) return res.status(404).send('Submission not found.');

  const { adminResponse, adminNickname } = req.body;

  // Get the current time in Philippine Time (PHT)
  const timestamp = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

  const formattedMessage = `
${timestamp}

[${submission.category}]

"${submission.message_title}"

${submission.message}

[${submission.message_to_admin}]
${submission.codename}
${submission.option}

-

[]${adminResponse}
${adminNickname}
`;

  const url = submission.photo_link
    ? `https://graph.facebook.com/v16.0/me/photos`
    : `https://graph.facebook.com/v16.0/me/feed`;

  const params = {
    message: formattedMessage,
    access_token: PAGE_ACCESS_TOKEN,
  };

  if (submission.photo_link) params.url = submission.photo_link;

  try {
    await axios.post(url, null, { params });
    submissions.splice(req.params.index, 1);
    saveSubmissions(submissions);
    res.send('Message approved and posted.');
  } catch (error) {
    console.error('Error posting to Facebook:', error.response?.data || error);
    res.status(500).send('Failed to post message.');
  }
});

// Admin: Decline a submission
app.post('/admin/decline/:index', (req, res) => {
  const submissions = loadSubmissions();
  submissions.splice(req.params.index, 1);
  saveSubmissions(submissions);
  res.send('Message declined.');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


