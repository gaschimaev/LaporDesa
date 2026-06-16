require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const port = process.env.PORT || 80;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// S3 Client Setup (Gunakan IAM Role di ECS agar tidak perlu hardcode key)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});

// Multer setup for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Database Connection
let pool;
try {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
    // Auto Create Table if not exists
  (async () => {
    try {
      // Connect without database first to ensure it exists
      const tempPool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0
      });
      const tempConn = await tempPool.getConnection();
      await tempConn.query("CREATE DATABASE IF NOT EXISTS " + process.env.DB_NAME);
      tempConn.release();
      tempPool.end();

      const connection = await pool.getConnection();
      await connection.query(
        "CREATE TABLE IF NOT EXISTS laporan (" +
        "  id INT AUTO_INCREMENT PRIMARY KEY," +
        "  pelapor VARCHAR(255) NOT NULL," +
        "  judul VARCHAR(255) NOT NULL," +
        "  deskripsi TEXT NOT NULL," +
        "  foto VARCHAR(255)" +
        ")"
      );
      connection.release();
      console.log('Database and table initialized successfully.');
    } catch (err) {
      console.error('Failed to init table:', err);
    }
  })();
} catch (error) {
  console.error('Failed to initialize database pool:', error);
}

// Routes
app.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM laporan ORDER BY id DESC');
    res.render('index', { laporan: rows, cloudfrontDomain: process.env.CLOUDFRONT_DOMAIN });
  } catch (error) {
    console.error(error);
    res.send('Database Error: ' + error.message);
  }
});

app.get('/lapor', (req, res) => {
  res.render('lapor');
});

app.post('/lapor', upload.single('foto'), async (req, res) => {
  try {
    const { pelapor, judul, deskripsi } = req.body;
    let fotoUrl = null;

    if (req.file) {
      const fileName = `laporan-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
      const bucketName = process.env.S3_BUCKET_NAME;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3Client.send(command);
      fotoUrl = fileName; 
    }

    await pool.query(
      'INSERT INTO laporan (pelapor, judul, deskripsi, foto) VALUES (?, ?, ?, ?)',
      [pelapor, judul, deskripsi, fotoUrl]
    );

    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.send('Terjadi kesalahan saat mengirim laporan.');
  }
});

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});



