const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const db = require("./db");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Serve pages
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "pages", "index.html"));
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "pages", "register.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "pages", "dashboard.html"));
});

// Register user
app.post("/registerUser", (req, res) => {
    const { username, email, password } = req.body;

    const sql = "INSERT INTO users(username,email,password) VALUES(?,?,?)";

    db.query(sql, [username, email, password], (err, result) => {
        if(err){
            res.send("Registration failed");
        } else {
            res.send("User registered successfully");
        }
    });
});

// Login user
app.post("/loginUser", (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email=? AND password=?";

    db.query(sql, [email, password], (err, result) => {
        if(result.length > 0){
            res.send("Login successful");
        } else {
            res.send("Invalid credentials");
        }
    });
});

// Add repair
app.post("/addRepair", (req, res) => {
    const {
        customer_name,
        phone_model,
        repair_type,
        repair_price
    } = req.body;

    const sql = `
    INSERT INTO repairs
    (customer_name, phone_model, repair_type, repair_price)
    VALUES(?,?,?,?)
    `;

    db.query(sql,
    [customer_name, phone_model, repair_type, repair_price],
    (err, result) => {
        if(err){
            res.send("Failed to add repair");
        } else {
            res.send("Repair added successfully");
        }
    });
});

// Get repairs
app.get("/repairs", (req, res) => {

    const sql = "SELECT * FROM repairs";

    db.query(sql, (err, result) => {
        if(err){
            res.send(err);
        } else {
            res.json(result);
        }
    });
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});