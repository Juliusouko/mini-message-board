import express from "express";
import crypto from "crypto";
import cors from "cors";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pool from "./config/db.js";
import jwt from "jsonwebtoken"; // Add this: npm install jsonwebtoken

dotenv.config();
const app = express();
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS - simplified (remove manual CORS headers)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*", // Set in Vercel env
    credentials: true,
  }),
);

// View engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Logging middleware
app.use((req, res, next) => {
  console.log("Request received:", req.method, req.url);
  next();
});

// Helper: Verify Telegram Auth
function verifyTelegramAuth(data) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN not set");
    return false;
  }

  const secret = crypto.createHash("sha256").update(botToken).digest();

  const checkString = Object.keys(data)
    .filter((key) => key !== "hash")
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(checkString)
    .digest("hex");

  return hmac === data.hash;
}

// Helper: Generate JWT
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "24h" });
}

// Helper: Verify JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware: Authenticate user from token
function authenticateUser(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.redirect("/login");
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.redirect("/login");
  }

  req.userId = decoded.userId;
  next();
}

// Routes

// Login page
app.get("/login", (req, res) => {
  res.render("login", {
    appName: "Aswito App",
    botUsername: process.env.TELEGRAM_BOT_USERNAME,
  });
});

// Auth endpoint
app.post("/create", async (req, res) => {
  const client = await pool.connect();

  try {
    const data = req.body;

    if (!verifyTelegramAuth(data)) {
      return res.status(403).json({
        success: false,
        error: "Invalid authentication",
      });
    }

    const { id, first_name, last_name, username } = data;

    await client.query("BEGIN");

    // Check existing user
    const existingAuth = await client.query(
      `SELECT users.*
       FROM auth_providers
       JOIN users ON users.id = auth_providers.user_id
       WHERE provider = 'telegram'
       AND provider_user_id = $1`,
      [id],
    );

    let user;

    if (existingAuth.rows.length > 0) {
      await client.query("COMMIT");
      user = existingAuth.rows[0];

      // Generate JWT token
      const token = generateToken(user.id);

      return res.json({
        success: true,
        user,
        token, // Send token to client
        isNewUser: false,
      });
    }

    // Create new user
    const newUser = await client.query(
      `INSERT INTO users (first_name, last_name, username)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [first_name, last_name || null, username || null],
    );

    const userId = newUser.rows[0].id;

    // Create auth provider
    await client.query(
      `INSERT INTO auth_providers (user_id, provider, provider_user_id)
       VALUES ($1, 'telegram', $2)`,
      [userId, id],
    );

    await client.query("COMMIT");

    user = newUser.rows[0];
    const token = generateToken(user.id);

    return res.json({
      success: true,
      user,
      token, // Send token to client
      isNewUser: true,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error in /create endpoint:", err);

    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "User already exists",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  } finally {
    client.release();
  }
});

// Dashboard (protected)
app.get("/dashboard", authenticateUser, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.userId,
    ]);

    if (result.rows.length === 0) {
      return res.redirect("/login");
    }

    res.render("dashboard", { user: result.rows[0] });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).send("Server error");
  }
});

// Get all users (for testing - remove in production or add auth)
app.get("/data", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, first_name, last_name, username, created_at FROM users ORDER BY created_at DESC",
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error("Database query failed:", err);
    res.status(500).json({ success: false, message: "Failed to fetch data" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

// For Vercel serverless
export default app;

// For local development
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`App running on http://localhost:${PORT}`);
  });
}
