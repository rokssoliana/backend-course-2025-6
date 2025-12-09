require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.SERVER_PORT || 3000;
const host = process.env.SERVER_HOST || '0.0.0.0';

// Middleware для JSON та форм
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);     // .jpg .png etc
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  }
});

const upload = multer({ storage });

// Додавання статичної папки для доступу до фото
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Підключення до Postgres
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.connect()
  .then(() => console.log('✅ DB connected'))
  .catch(err => console.error('DB init error:', err));

// ------------------- API ------------------- //

// CREATE: POST /inventory
app.post('/inventory', upload.single('photo'), async (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) return res.status(400).json({ error: "inventory_name is required" });

  const photo = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const result = await pool.query(
      'INSERT INTO inventory (name, description, photo) VALUES ($1, $2, $3) RETURNING *',
      [inventory_name, description || '', photo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ALL: GET /inventory
app.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ONE: GET /inventory/:id
app.get('/inventory/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE id=$1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: PUT /inventory/:id
app.put('/inventory/:id', upload.single('photo'), async (req, res) => {
  const { id } = req.params;
  const { inventory_name, description } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (inventory_name) { fields.push(`name=$${idx++}`); values.push(inventory_name); }
    if (description) { fields.push(`description=$${idx++}`); values.push(description); }
    if (photo) { fields.push(`photo=$${idx++}`); values.push(photo); }

    if (!fields.length) return res.status(400).json({ error: "Nothing to update" });

    values.push(id);

    const result = await pool.query(
      `UPDATE inventory SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    );

    if (!result.rows.length) return res.status(404).json({ error: "Not found" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: DELETE /inventory/:id
app.delete('/inventory/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM inventory WHERE id=$1 RETURNING *', [id]);

    if (!result.rows.length) return res.status(404).json({ error: "Not found" });

    res.json({ message: "Deleted", device: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('Inventory API is running. Nodemon test OK!');
});

// Catch-all
app.use((req, res) => {
  res.status(405).send('Method Not Allowed');
});

// ------------------- Start server ------------------- //
app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
