const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- ข้อมูล login ระบบหลังบ้าน ---
const ADMIN_USER = 'admin';
const ADMIN_PASS = '123456';

// --- ที่เก็บข้อมูลแบบสอบถาม ---
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

function readSubmissions() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}
function writeSubmissions(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

// --- ตัวเลือกที่ถูกต้อง (ใช้ตรวจสอบฝั่ง server) ---
const AUDIENCES = ['GenX', 'GenY', 'GenZ', 'GenAlpha', 'GenBeta'];
const STRATEGIES = ['ValueProposition', 'Brand Storytelling', 'Selling Approach', 'Customer Experience'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'marketing7-survey-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

// --- middleware ตรวจสอบสิทธิ์ admin ---
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  return res.redirect('/login');
}

// --- API: บันทึกแบบสอบถาม ---
app.post('/api/submit', (req, res) => {
  const { email, audience, strategy } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ ok: false, error: 'กรุณากรอกอีเมลให้ถูกต้อง' });
  }
  if (!AUDIENCES.includes(audience)) {
    return res.status(400).json({ ok: false, error: 'กรุณาเลือกกลุ่มเป้าหมาย' });
  }
  if (!STRATEGIES.includes(strategy)) {
    return res.status(400).json({ ok: false, error: 'กรุณาเลือกกลยุทธ์' });
  }
  const list = readSubmissions();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    email: email.trim().toLowerCase().slice(0, 200),
    audience,
    strategy,
    createdAt: new Date().toISOString()
  };
  list.push(entry);
  writeSubmissions(list);
  res.json({ ok: true, id: entry.id });
});

// --- API: login ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'username หรือ password ไม่ถูกต้อง' });
});

// --- API: logout ---
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// --- API: ดึงผลลัพธ์ + สถิติ (ต้อง login) ---
app.get('/api/results', requireAuth, (req, res) => {
  const list = readSubmissions();
  const byAudience = {};
  const byStrategy = {};
  AUDIENCES.forEach(a => { byAudience[a] = 0; });
  STRATEGIES.forEach(s => { byStrategy[s] = 0; });
  list.forEach(item => {
    if (byAudience[item.audience] !== undefined) byAudience[item.audience]++;
    if (byStrategy[item.strategy] !== undefined) byStrategy[item.strategy]++;
  });
  res.json({
    ok: true,
    total: list.length,
    byAudience,
    byStrategy,
    submissions: list.slice().reverse()
  });
});

// --- API: ลบรายการ (ต้อง login) ---
app.delete('/api/results/:id', requireAuth, (req, res) => {
  const list = readSubmissions();
  const next = list.filter(item => item.id !== req.params.id);
  writeSubmissions(next);
  res.json({ ok: true, removed: list.length - next.length });
});

// --- หน้าเว็บ ---
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/dashboard', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
app.get('/admin', (req, res) => res.redirect('/dashboard'));

// --- เสิร์ฟแบบสอบถาม (หน้าแรก) ---
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log('==============================================');
  console.log('  Marketing 7 - ระบบแบบสอบถาม');
  console.log('==============================================');
  console.log(`  แบบสอบถาม      : http://localhost:${PORT}/`);
  console.log(`  ระบบหลังบ้าน    : http://localhost:${PORT}/login`);
  console.log(`  Dashboard      : http://localhost:${PORT}/dashboard`);
  console.log(`  user: ${ADMIN_USER}  /  password: ${ADMIN_PASS}`);
  console.log('==============================================');
});
