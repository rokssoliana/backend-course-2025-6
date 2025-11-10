// index.js
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');

// === Commander.js для аргументів командного рядка ===
const program = new Command();
program
  .requiredOption('-h, --host <host>', 'server host address')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <path>', 'path to cache directory');
program.parse(process.argv);
const options = program.opts();

// === Створення директорії кешу ===
const cacheDir = path.resolve(options.cache);
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
const uploadDir = path.join(cacheDir, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// === Express і Multer ===
const app = express();
const upload = multer({ dest: uploadDir });
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// === Тимчасове сховище інвентарю ===
let inventory = [];
let nextId = 1;

// === POST /register ===
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;
  const photo = req.file;

  if (!inventory_name) return res.status(400).json({ error: 'Inventory name is required' });

  const newItem = {
    id: nextId++,
    name: inventory_name,
    description: description || '',
    photoPath: photo ? photo.path : null
  };

  inventory.push(newItem);
  res.status(201).json(newItem);
});

// === GET /inventory ===
app.get('/inventory', (req, res) => {
  const result = inventory.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    photo: item.photoPath ? `/inventory/${item.id}/photo` : null
  }));
  res.status(200).json(result);
});

// === GET /inventory/:id ===
app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  res.status(200).json({
    id: item.id,
    name: item.name,
    description: item.description,
    photo: item.photoPath ? `/inventory/${item.id}/photo` : null
  });
});

// === PUT /inventory/:id ===
app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const { name, description } = req.body;
  if (name) item.name = name;
  if (description) item.description = description;

  res.status(200).json(item);
});

// === GET /inventory/:id/photo ===
app.get('/inventory/:id/photo', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);
  if (!item || !item.photoPath || !fs.existsSync(item.photoPath)) return res.status(404).send('Not found');

  res.sendFile(path.resolve(item.photoPath), { headers: { 'Content-Type': 'image/jpeg' } });
});

// === PUT /inventory/:id/photo ===
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  if (req.file) item.photoPath = req.file.path;
  res.status(200).json(item);
});

// === DELETE /inventory/:id ===
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = inventory.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });

  inventory.splice(index, 1);
  res.status(200).json({ message: 'Deleted' });
});

// === GET /RegisterForm.html ===
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

// === GET /SearchForm.html ===
app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

// === POST /search ===
app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;
  const item = inventory.find(i => i.id === parseInt(id));
  if (!item) return res.status(404).json({ error: 'Not found' });

  const result = {
    id: item.id,
    name: item.name,
    description: item.description
  };

  if (has_photo === 'on' && item.photoPath) {
    result.photo = `/inventory/${item.id}/photo`;
  }

  res.status(200).json(result);
});

app.all('/*', (req, res) => {
  res.status(405).send('Method Not Allowed');
});

// === Запуск сервера ===
app.listen(parseInt(options.port), options.host, () => {
  console.log(`Server listening at http://${options.host}:${options.port}`);
});
