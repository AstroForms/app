const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

const API_KEY = 'yQw2asgacasdsacsadSasdsadadH9dF1gK3lP5zX7nC0rA2jM4qU6yS8vW0eT2';

app.post('/upload-image', upload.single('image'), (req, res) => {
  const clientKey = req.headers['x-api-key'];
  if (clientKey !== API_KEY) return res.status(401).json({ error: 'Invalid API key' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = path.extname(req.file.originalname);
  const newName = req.file.filename + ext;
  const newPath = path.join(__dirname, 'uploads', newName);
  fs.renameSync(req.file.path, newPath);

  const imageUrl = `/uploads/${newName}`;
  res.json({ url: imageUrl });
});


app.get('/image/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(filePath);
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(3001, () => {
  console.log('Express API läuft auf http://localhost:3001');
});
