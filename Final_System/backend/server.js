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
        console.log('👉 Make sure XAMPP MySQL is running and you ran database.sql + migration_add_clients.sql');
        process.exit(1);
    }
    console.log('✅ Connected to MySQL (repair_shop_db)');
});

// ─── AUTH / ROLE MIDDLEWARE ───────────────────────────────────────
function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ success: false, message: 'Not logged in' });
}

// Only allow admin or technician (staff) — blocks clients from staff-only routes
function requireStaff(req, res, next) {
    if (req.session && req.session.user && req.session.user.role !== 'client') return next();
    return res.status(403).json({ success: false, message: 'Staff access only' });
}

// Only allow admin — used for things like adding/removing services
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') return next();
    return res.status(403).json({ success: false, message: 'Admin access only' });
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────

// Register — role can be 'technician', 'admin', or 'client'
app.post('/api/auth/register', async (req, res) => {
    const { full_name, email, password, role, phone } = req.body;
    if (!full_name || !email || !password)
        return res.json({ success: false, message: 'All fields are required' });

    const allowedRoles = ['admin', 'technician', 'client'];
    const finalRole = allowedRoles.includes(role) ? role : 'client';

    try {
        const [exists] = await db.promise().query('SELECT id FROM users WHERE email = ?', [email]);
        if (exists.length > 0)
            return res.json({ success: false, message: 'Email already registered' });

        const hashed = await bcrypt.hash(password, 10);
        const [result] = await db.promise().query(
            'INSERT INTO users (full_name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
            [full_name, email, hashed, finalRole, phone || null]
        );
        res.json({ success: true, message: 'Account created successfully!', userId: result.insertId });
    } catch (err) {
        res.json({ success: false, message: 'Server error: ' + err.message });
    }
});

// Login — works for all roles, frontend redirects based on role
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

        req.session.user = { id: user.id, name: user.full_name, email: user.email, role: user.role, phone: user.phone };
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

// Check session — frontend uses this to decide which dashboard to show
app.get('/api/auth/me', (req, res) => {
    if (req.session.user) return res.json({ success: true, user: req.session.user });
    res.json({ success: false });
});

// ─── REPAIR SERVICES ROUTES ───────────────────────────────────────

// Get all services (public to any logged-in user — clients can browse pricing too)
app.get('/api/services', async (req, res) => {
    try {
        const [rows] = await db.promise().query('SELECT * FROM repair_services ORDER BY device_type, price');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Add new service — staff only
app.post('/api/services', requireAuth, requireStaff, async (req, res) => {
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

// Delete service — staff only
app.delete('/api/services/:id', requireAuth, requireStaff, async (req, res) => {
    try {
        await db.promise().query('DELETE FROM repair_services WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Service deleted' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ─── TICKET ROUTES ────────────────────────────────────────────────

function generateTicketNumber() {
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TKT-${y}${m}${d}-${rand}`;
}

// Get tickets — STAFF sees ALL tickets, CLIENT sees ONLY their own (role-based filtering)
app.get('/api/tickets', requireAuth, async (req, res) => {
    try {
        let query = `
            SELECT t.*, rs.repair_type, rs.device_type as service_device,
                   u.full_name as technician_name, c.full_name as client_name
            FROM repair_tickets t
            LEFT JOIN repair_services rs ON t.repair_service_id = rs.id
            LEFT JOIN users u ON t.technician_id = u.id
            LEFT JOIN users c ON t.client_id = c.id
        `;
        const params = [];

        if (req.session.user.role === 'client') {
            // Client can ONLY ever see tickets where client_id matches their own user id
            query += ' WHERE t.client_id = ?';
            params.push(req.session.user.id);
        }

        query += ' ORDER BY t.created_at DESC';

        const [rows] = await db.promise().query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Create ticket — staff only (clients don't create their own tickets; front-desk does it for them)
app.post('/api/tickets', requireAuth, requireStaff, async (req, res) => {
    const { customer_name, customer_phone, device_type, device_model, repair_service_id, issue_description, total_price, client_id } = req.body;
    if (!customer_name || !customer_phone || !device_type)
        return res.json({ success: false, message: 'Customer name, phone, and device type are required' });

    const ticket_number = generateTicketNumber();
    try {
        await db.promise().query(
            `INSERT INTO repair_tickets (ticket_number, customer_name, customer_phone, device_type, device_model, repair_service_id, issue_description, total_price, technician_id, client_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ticket_number, customer_name, customer_phone, device_type, device_model, repair_service_id || null, issue_description, total_price || null, req.session.user.id, client_id || null]
        );
        res.json({ success: true, message: 'Ticket created!', ticket_number });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Update a ticket's details — staff only
app.patch('/api/tickets/:id', requireAuth, requireStaff, async (req, res) => {
    const { customer_name, customer_phone, device_type, device_model, repair_service_id, issue_description, total_price, status, client_id } = req.body;
    if (!customer_name || !customer_phone || !device_type)
        return res.json({ success: false, message: 'Customer name, phone, and device type are required' });

    try {
        await db.promise().query(
            `UPDATE repair_tickets
             SET customer_name = ?, customer_phone = ?, device_type = ?, device_model = ?, repair_service_id = ?, issue_description = ?, total_price = ?, status = ?, client_id = ?
             WHERE id = ?`,
            [customer_name, customer_phone, device_type, device_model, repair_service_id || null, issue_description, total_price || null, status || null, client_id || null, req.params.id]
        );
        res.json({ success: true, message: 'Ticket updated' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Update ticket status — staff only
app.patch('/api/tickets/:id/status', requireAuth, requireStaff, async (req, res) => {
    const { status } = req.body;
    try {
        await db.promise().query('UPDATE repair_tickets SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true, message: 'Status updated' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Record a payment against a ticket — staff only
app.post('/api/tickets/:id/payment', requireAuth, requireStaff, async (req, res) => {
    const { amount, payment_method } = req.body;
    const ticketId = req.params.id;
    if (!amount || amount <= 0)
        return res.json({ success: false, message: 'Enter a valid payment amount' });

    try {
        // Log the payment
        await db.promise().query(
            'INSERT INTO payments (ticket_id, amount, payment_method, recorded_by) VALUES (?, ?, ?, ?)',
            [ticketId, amount, payment_method || 'Cash', req.session.user.id]
        );
        // Increase the running amount_paid on the ticket
        await db.promise().query(
            'UPDATE repair_tickets SET amount_paid = amount_paid + ? WHERE id = ?',
            [amount, ticketId]
        );
        res.json({ success: true, message: 'Payment recorded' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Get payment history for one ticket — staff or the owning client
app.get('/api/tickets/:id/payments', requireAuth, async (req, res) => {
    try {
        // If the requester is a client, make sure this ticket actually belongs to them
        if (req.session.user.role === 'client') {
            const [own] = await db.promise().query('SELECT id FROM repair_tickets WHERE id = ? AND client_id = ?', [req.params.id, req.session.user.id]);
            if (own.length === 0) return res.status(403).json({ success: false, message: 'Not your ticket' });
        }
        const [rows] = await db.promise().query('SELECT * FROM payments WHERE ticket_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Delete ticket — staff only
app.delete('/api/tickets/:id', requireAuth, requireStaff, async (req, res) => {
    try {
        await db.promise().query('DELETE FROM repair_tickets WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Ticket deleted' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Get list of client accounts — staff only (used in "New Ticket" form to link a client)
app.get('/api/clients', requireAuth, requireStaff, async (req, res) => {
    try {
        const [rows] = await db.promise().query("SELECT id, full_name, email, phone FROM users WHERE role = 'client' ORDER BY full_name");
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ─── DASHBOARD STATS (staff only — shop-wide numbers) ─────────────
app.get('/api/stats', requireAuth, requireStaff, async (req, res) => {
    try {
        const [[{ total }]] = await db.promise().query('SELECT COUNT(*) as total FROM repair_tickets');
        const [[{ pending }]] = await db.promise().query("SELECT COUNT(*) as pending FROM repair_tickets WHERE status='Pending'");
        const [[{ inprogress }]] = await db.promise().query("SELECT COUNT(*) as inprogress FROM repair_tickets WHERE status='In Progress'");
        const [[{ completed }]] = await db.promise().query("SELECT COUNT(*) as completed FROM repair_tickets WHERE status='Completed' OR status='Delivered'");
        const [[{ revenue }]] = await db.promise().query("SELECT COALESCE(SUM(amount_paid),0) as revenue FROM repair_tickets");
        const [[{ outstanding }]] = await db.promise().query("SELECT COALESCE(SUM(total_price - amount_paid),0) as outstanding FROM repair_tickets WHERE total_price IS NOT NULL");
        res.json({ success: true, stats: { total, pending, inprogress, completed, revenue, outstanding } });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// Client's own quick stats (their tickets + balance only)
app.get('/api/client/stats', requireAuth, async (req, res) => {
    if (req.session.user.role !== 'client')
        return res.status(403).json({ success: false, message: 'Client access only' });
    try {
        const cid = req.session.user.id;
        const [[{ total }]] = await db.promise().query('SELECT COUNT(*) as total FROM repair_tickets WHERE client_id = ?', [cid]);
        const [[{ active }]] = await db.promise().query("SELECT COUNT(*) as active FROM repair_tickets WHERE client_id = ? AND status IN ('Pending','In Progress')", [cid]);
        const [[{ owed }]] = await db.promise().query("SELECT COALESCE(SUM(total_price - amount_paid),0) as owed FROM repair_tickets WHERE client_id = ? AND total_price IS NOT NULL", [cid]);
        res.json({ success: true, stats: { total, active, owed } });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ─── SERVE FRONTEND PAGES ─────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/dashboard.html')));
app.get('/pricing', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/pricing.html')));
app.get('/tickets', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/tickets.html')));
app.get('/client-portal', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/client-portal.html')));

// ─── START SERVER ─────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🔧 Repair Shop Server running at http://localhost:${PORT}`);
    console.log(`📋 Login page: http://localhost:${PORT}/`);
    console.log(`📊 Staff Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`👤 Client Portal:   http://localhost:${PORT}/client-portal`);
    console.log(`💰 Pricing:   http://localhost:${PORT}/pricing\n`);
});