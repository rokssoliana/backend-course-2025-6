const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// Парсинг аргументів командного рядка
const program = new Command();
program
  .requiredOption('-h, --host <host>', 'server host address')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <path>', 'path to cache directory');

program.parse(process.argv);
const options = program.opts();

// Налаштування каталогів для кешу та завантажених файлів
const cacheDir = path.resolve(options.cache);
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

const uploadDir = path.join(cacheDir, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer для завантаження файлів
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, unique + ext);
  }
});
const upload = multer({ storage });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Дані інвентарю
let inventory = [];
let nextId = 1;

// Роутинг
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) return res.status(400).json({ error: "inventory_name is required" });

  const newItem = {
    id: nextId++,
    name: inventory_name,
    description: description || "",
    photo: req.file ? `/uploads/${req.file.filename}` : null
  };

  inventory.push(newItem);
  res.status(201).json(newItem);
});

app.get('/inventory', (req, res) => res.json(inventory));
app.get('/inventory/:id', (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

app.put('/inventory/:id', (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });
  const { name, description } = req.body;
  if (name) item.name = name;
  if (description) item.description = description;
  res.json(item);
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  item.photo = `/uploads/${req.file.filename}`;
  res.json({ message: "Photo updated", photo: item.photo });
});

app.delete('/inventory/:id', (req, res) => {
  const index = inventory.findIndex(i => i.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Not found" });
  inventory.splice(index, 1);
  res.json({ message: "Deleted" });
});

app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;
  const item = inventory.find(i => i.id === parseInt(id));
  if (!item) return res.status(404).json({ error: "Not found" });
  const result = { id: item.id, name: item.name, description: item.description };
  if (has_photo === "on" && item.photo) result.photo = item.photo;
  res.json(result);
});

// Обробка всіх неопрацьованих маршрутів
app.use((req, res) => {
  res.status(405).send('Method Not Allowed');
});

// Запуск сервера
app.listen(parseInt(options.port), options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});
