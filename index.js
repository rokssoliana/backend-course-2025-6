const { Command } = require("commander");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

const program = new Command();
program
  .requiredOption("-h, --host <host>", "server host address")
  .requiredOption("-p, --port <port>", "server port")
  .requiredOption("-c, --cache <path>", "path to cache directory");

program.parse(process.argv);
const options = program.opts();

// Create cache + uploads
const cacheDir = path.resolve(options.cache);
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

const uploadDir = path.join(cacheDir, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, name + ext);
  }
});
const upload = multer({ storage });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve HTML forms
app.use(express.static(__dirname));

// Додаємо шлях до uploads
app.use('/uploads', express.static(uploadDir));

// Swagger
const swaggerDoc = YAML.load(path.join(__dirname, "swagger.yaml"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// In-memory DB
let inventory = [];
let nextId = 1;

/* ===========================
      POST /register
=========================== */
app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name)
    return res.status(400).json({ error: "inventory_name required" });

  const item = {
    id: nextId++,
    name: inventory_name,
    description: description || "",
    photo: req.file ? "/uploads/" + req.file.filename : null
  };

  inventory.push(item);
  res.status(201).json(item);
});

/* ===========================
      POST /search
=========================== */
app.post("/search", (req, res) => {
  const { id, has_photo } = req.body;

  const item = inventory.find(i => i.id === parseInt(id));
  if (!item) return res.status(404).json({ error: "Not found" });

  const result = {
    id: item.id,
    name: item.name,
    description: item.description,
  };

  if (has_photo === "on" && item.photo) result.photo = item.photo;

  res.json(result);
});

/* ===========================
   GET /inventory (just in case)
=========================== */
app.get("/inventory", (req, res) => {
  res.json(inventory);
});

/* ===========================
   ERROR HANDLER — ONLY ONE
=========================== */
app.use((req, res) => {
  res.status(405).send("Method Not Allowed");
});

/* ===========================
   START SERVER
=========================== */
app.listen(parseInt(options.port), options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});
