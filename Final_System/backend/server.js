const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// ─── MIDDLEWARE ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use(session({
    secret: 'repairshop_secret_key_2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// ─── DATABASE CONNECTION (XAMPP MySQL) ────────────────────────────
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',          // XAMPP default: empty password
    database: 'repair_shop_db',
    port: 3306
});

db.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.log('👉 Make sure XAMPP MySQL is running and you ran database.sql');
        process.exit(1);
    }
    console.log('✅ Connected to MySQL (repair_shop_db)');
});

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────
function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ success: false, message: 'Not logged in' });
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
    const { full_name, email, password, role } = req.body;
    if (!full_name || !email || !password)
        return res.json({ success: false, message: 'All fields are required' });

    try {
        const [exists] = await db.promise().query('SELECT id FROM users WHERE email = ?', [email]);
        if (exists.length > 0)
            return res.json({ success: false, message: 'Email already registered' });

        const hashed = await bcrypt.hash(password, 10);
        await db.promise().query(
            'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
            [full_name, email, hashed, role || 'technician']
        );
        res.json({ success: true, message: 'Account created successfully!' });
    } catch (err) {
        res.json({ success: false, message: 'Server error: ' + err.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.json({ success: false, message: 'Email and password required' });

    try {
        const [rows] = await db.promise().query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0)
            return res.json({ success: false, message: 'Invalid email or password' });

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.json({ success: false, message: 'Invalid email or password' });

        req.session.user = { id: user.id, name: user.full_name, email: user.email, role: user.role };
        res.json({ success: true, message: 'Login successful', user: req.session.user });
    } catch (err) {
        res.json({ success: false, message: 'Server error: ' + err.message });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

// Check session
app.get('/api/auth/me', (req, res) => {
    if (req.session.user) return res.json({ success: true, user: req.session.user });
    res.json({ success: false });
});

// ─── REPAIR SERVICES ROUTES ───────────────────────────────────────

// Get all services (public - for pricing page)
app.get('/api/services', async (req, res) => {
    try {
        const [rows] = await db.promise().query('SELECT * FROM repair_services ORDER BY device_type, price');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Add new service (admin only)
app.post('/api/services', requireAuth, async (req, res) => {
    const { device_type, repair_type, description, price, duration_hours } = req.body;
    if (!device_type || !repair_type || !price)
        return res.json({ success: false, message: 'Device type, repair type, and price are required' });
    try {
        await db.promise().query(
            'INSERT INTO repair_services (device_type, repair_type, description, price, duration_hours) VALUES (?, ?, ?, ?, ?)',
            [device_type, repair_type, description, price, duration_hours || 1]
        );
        res.json({ success: true, message: 'Service added successfully' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Delete service
app.delete('/api/services/:id', requireAuth, async (req, res) => {
    try {
        await db.promise().query('DELETE FROM repair_services WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Service deleted' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ─── TICKET ROUTES ────────────────────────────────────────────────

// Generate ticket number
function generateTicketNumber() {
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TKT-${y}${m}${d}-${rand}`;
}

// Get all tickets
app.get('/api/tickets', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.promise().query(`
            SELECT t.*, rs.repair_type, rs.device_type as service_device, u.full_name as technician_name
            FROM repair_tickets t
            LEFT JOIN repair_services rs ON t.repair_service_id = rs.id
            LEFT JOIN users u ON t.technician_id = u.id
            ORDER BY t.created_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Create ticket
app.post('/api/tickets', requireAuth, async (req, res) => {
    const { customer_name, customer_phone, device_type, device_model, repair_service_id, issue_description, total_price } = req.body;
    if (!customer_name || !customer_phone || !device_type)
        return res.json({ success: false, message: 'Customer name, phone, and device type are required' });

    const ticket_number = generateTicketNumber();
    try {
        await db.promise().query(
            `INSERT INTO repair_tickets (ticket_number, customer_name, customer_phone, device_type, device_model, repair_service_id, issue_description, total_price, technician_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ticket_number, customer_name, customer_phone, device_type, device_model, repair_service_id || null, issue_description, total_price || null, req.session.user.id]
        );
        res.json({ success: true, message: 'Ticket created!', ticket_number });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Update ticket status
app.patch('/api/tickets/:id/status', requireAuth, async (req, res) => {
    const { status } = req.body;
    try {
        await db.promise().query('UPDATE repair_tickets SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true, message: 'Status updated' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Delete ticket
app.delete('/api/tickets/:id', requireAuth, async (req, res) => {
    try {
        await db.promise().query('DELETE FROM repair_tickets WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Ticket deleted' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ─── DASHBOARD STATS ──────────────────────────────────────────────
app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const [[{ total }]] = await db.promise().query('SELECT COUNT(*) as total FROM repair_tickets');
        const [[{ pending }]] = await db.promise().query("SELECT COUNT(*) as pending FROM repair_tickets WHERE status='Pending'");
        const [[{ inprogress }]] = await db.promise().query("SELECT COUNT(*) as inprogress FROM repair_tickets WHERE status='In Progress'");
        const [[{ completed }]] = await db.promise().query("SELECT COUNT(*) as completed FROM repair_tickets WHERE status='Completed' OR status='Delivered'");
        const [[{ revenue }]] = await db.promise().query("SELECT COALESCE(SUM(total_price),0) as revenue FROM repair_tickets WHERE status='Delivered'");
        res.json({ success: true, stats: { total, pending, inprogress, completed, revenue } });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ─── SERVE FRONTEND PAGES ─────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/dashboard.html')));
app.get('/pricing', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/pricing.html')));
app.get('/tickets', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/tickets.html')));

// ─── START SERVER ─────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🔧 Repair Shop Server running at http://localhost:${PORT}`);
    console.log(`📋 Login page: http://localhost:${PORT}/`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`💰 Pricing:   http://localhost:${PORT}/pricing\n`);
});
