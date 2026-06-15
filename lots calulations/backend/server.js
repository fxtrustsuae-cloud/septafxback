const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { processTradeFile } = require('./processor');
const { generateExcelReport } = require('./exporter');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Setup safe tmp dir across OS or Serverless environments
const TMP_DIR = path.join(os.tmpdir(), 'scalping-detector-tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}_${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  }
});

// In-memory session store (keyed by session ID)
const sessions = new Map();

// ─────────────────────────────────────────────
//  POST /upload
// ─────────────────────────────────────────────
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const startDate         = req.body.startDate || null;
    const endDate           = req.body.endDate   || null;
    let scalpingTimeLimit   = parseFloat(req.body.scalpingTimeLimit);
    if (isNaN(scalpingTimeLimit)) scalpingTimeLimit = 3;

    const result = await processTradeFile(req.file.path, startDate, endDate, scalpingTimeLimit);

    // Store result for export
    const sessionId = uuidv4();
    sessions.set(sessionId, result);

    // Clean old sessions (keep max 20)
    if (sessions.size > 20) {
      const oldestKey = sessions.keys().next().value;
      sessions.delete(oldestKey);
    }

    // Clean up uploaded tmp file
    fs.unlink(req.file.path, () => {});

    res.json({ sessionId, ...result });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    console.error('Processing error:', err);
    res.status(500).json({ error: err.message || 'File processing failed' });
  }
});

// ─────────────────────────────────────────────
//  GET /export/:sessionId
// ─────────────────────────────────────────────
app.get('/export/:sessionId', async (req, res) => {
  const data = sessions.get(req.params.sessionId);
  if (!data) return res.status(404).json({ error: 'Session not found or expired' });

  try {
    const filePath = await generateExcelReport(data, TMP_DIR);
    res.download(filePath, 'scalping_report.xlsx', () => {
      fs.unlink(filePath, () => {});
    });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ─────────────────────────────────────────────
//  GET / → serve frontend
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Scalping Detector running at http://localhost:${PORT}\n`);
});
