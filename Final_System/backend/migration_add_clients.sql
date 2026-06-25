-- =============================================
-- MIGRATION: Add Client Role + Payment Tracking
-- Run this in phpMyAdmin > SQL tab on your EXISTING repair_shop_db
-- Safe to run even if some parts already exist
-- =============================================

USE repair_shop_db;

-- 1. Update users.role to allow 'client' in addition to admin/technician
ALTER TABLE users
    MODIFY COLUMN role ENUM('admin', 'technician', 'client') DEFAULT 'technician';

-- 1b. Add a phone column so clients can be reached (used by the client account too)
ALTER TABLE users
    ADD COLUMN phone VARCHAR(20) NULL AFTER email;

-- 2. Link a ticket to the CLIENT who owns it (separate from technician_id)
ALTER TABLE repair_tickets
    ADD COLUMN client_id INT NULL AFTER technician_id;

ALTER TABLE repair_tickets
    ADD CONSTRAINT fk_ticket_client
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Track payments: how much has been paid so far
ALTER TABLE repair_tickets
    ADD COLUMN amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total_price;

-- 4. Optional: a simple payments log (one row per payment received)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('Cash','M-Pesa','Card','Bank Transfer') DEFAULT 'Cash',
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- DEMO CLIENT ACCOUNT
-- Don't insert a fake password hash here — bcrypt hashes are generated
-- per-password at runtime, so a copy-pasted hash won't actually work.
-- Instead, just register a demo client through the app itself:
--   1. Go to http://localhost:3000
--   2. Click "Register"
--   3. Fill in: Name, Email, Password, and select Role = "Client"
--   4. Log in with that account to see the Client Portal
-- =============================================
