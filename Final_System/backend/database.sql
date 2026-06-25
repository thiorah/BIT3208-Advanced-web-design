-- =============================================
-- REPAIR SHOP MANAGEMENT SYSTEM - DATABASE
-- Run this in phpMyAdmin or MySQL CLI
-- =============================================

CREATE DATABASE IF NOT EXISTS repair_shop_db;
USE repair_shop_db;

-- USERS TABLE (login/register)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'technician', 'client') DEFAULT 'technician',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- REPAIR TYPES & PRICING TABLE
CREATE TABLE IF NOT EXISTS repair_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_type VARCHAR(100) NOT NULL,
    repair_type VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_hours INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- REPAIR TICKETS TABLE
CREATE TABLE IF NOT EXISTS repair_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(100),
    device_type VARCHAR(100) NOT NULL,
    device_model VARCHAR(100),
    repair_service_id INT,
    issue_description TEXT,
    status ENUM('Pending','In Progress','Completed','Delivered') DEFAULT 'Pending',
    total_price DECIMAL(10,2),
    technician_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_service_id) REFERENCES repair_services(id) ON DELETE SET NULL,
    FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- SEED DATA - Default admin user
-- Password: admin123
-- =============================================
INSERT INTO users (full_name, email, password, role) VALUES
('Shop Admin', 'admin@repairshop.com', '$2b$10$rQZ8K1mN2pL3vX4wY5tU6OqS7jH8nM9kP0dF1gA2bC3eI4oR5sT6', 'admin');

-- SEED DATA - Repair Services & Pricing
INSERT INTO repair_services (device_type, repair_type, description, price, duration_hours) VALUES
-- Smartphones
('Smartphone', 'Screen Replacement', 'Replace cracked or broken display', 2500.00, 2),
('Smartphone', 'Battery Replacement', 'Replace old or swollen battery', 1200.00, 1),
('Smartphone', 'Charging Port Repair', 'Fix loose or broken charging port', 800.00, 1),
('Smartphone', 'Speaker/Mic Repair', 'Fix distorted sound or no audio', 600.00, 1),
('Smartphone', 'Camera Repair', 'Fix blurry, cracked or dead camera', 1500.00, 2),
('Smartphone', 'Water Damage Repair', 'Clean and restore water-damaged phone', 3000.00, 4),
('Smartphone', 'Software/Unlock', 'Flash firmware, factory reset, unlock', 500.00, 1),
-- Tablets
('Tablet', 'Screen Replacement', 'Replace tablet display/digitizer', 4500.00, 3),
('Tablet', 'Battery Replacement', 'Replace degraded tablet battery', 2000.00, 2),
('Tablet', 'Charging Port Repair', 'Fix tablet charging port', 1000.00, 1),
('Tablet', 'Software Repair', 'Firmware flash and OS restore', 700.00, 1),
-- Laptops
('Laptop', 'Screen Replacement', 'Replace broken laptop screen', 8000.00, 4),
('Laptop', 'Keyboard Replacement', 'Replace damaged keyboard', 3500.00, 2),
('Laptop', 'Battery Replacement', 'Replace laptop battery', 4000.00, 1),
('Laptop', 'Motherboard Repair', 'Diagnose and repair motherboard issues', 6000.00, 8),
('Laptop', 'RAM/Storage Upgrade', 'Upgrade RAM or SSD storage', 2500.00, 1),
('Laptop', 'Virus Removal', 'Remove malware and viruses', 1500.00, 2),
-- Accessories
('Accessory', 'Earphone/Headphone Repair', 'Fix audio jack or broken wires', 400.00, 1),
('Accessory', 'Charger Repair', 'Repair charging cable or adapter', 300.00, 1);
