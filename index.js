import express from "express";
import crypto from "crypto";
import cors from "cors";
import { Resend } from "resend";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pool from "./config/db.js";
import jwt from "jsonwebtoken"; // Add this: npm install jsonwebtoken

dotenv.config();
const app = express();
const PORT = 3000;
const resend = new Resend(process.env.RESEND_API_KEY);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const assetsPath = path.join(__dirname, "public");
app.use(express.static(assetsPath));
app.set("views", path.join(__dirname, "views"));

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

app.post("/subscribe", async (req, res) => {
  const { email } = req.body;
  console.log(email)

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    await resend.emails.send({
      from: process.env.MESSAGE_FROM,
      to: process.env.MESSAGE_TO,
      subject: "New Newsletter Subscriber",
      text: `New subscriber: ${email}`,
    });

    res.json({ message: "Subscription successful!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong." });
  }
});


// welcome
app.get("/", (req, res) => {
  res.render("welcome", {
    siteName: "Aswito INC",
    pageTitle: "Welcome",
    description: "Welcome to aswito.com this is where you belong"
  });
});
// root
app.get("/blog", (req, res) => {
  res.render("index", {
    pageTitle: "Aswito INC",
    description:
      "This is aswito.com an upcoming website being developed in Kenya",
    siteName: "Aswito INC",
    article: {
      title: "This is the first blog on Aswito INC",
      date: "Jan 15, 2026",
      readTime: 8,
      author: {
        name: "Julius Ouko",
        avatar: "public/resources/julius_ouko.jpg",
      },
      content: [
        {
          type: "paragraph",
          text: "Whatever you're seeing took time and love for the game to accomplish.",
        },
        { type: "heading", text: "First feature: Sweet Blogs" },
        { type: "code", text: "fn new_website(rust) {}" },
        { type: "heading", text: "To our user make sure you enjoy" },
        {
          type: "paragraph",
          text: "Life is short enjoy but do happy siiieet!",
        },
        { type: "heading", text: "What is aswito all about" },
        { type: "paragraph", text: "This is a website for happy people, FYI." },
      ],
    },

    sidebarPosts: [
      { title: "Check Dr.Sweet ..", slug: "check-dr-sweet" },
      { title: "Why am I broke?", slug: "why-am-i-broke" },
      { title: "A date with Ruto", slug: "a-date-with-ruto" },
      { title: "Kenya ni landmawe", slug: "kenya-ni-landmawe" },
      { title: "Siasa mbaya uchumi poa", slug: "siasa-mbaya-uchumi-poa" },
      { title: "Weka pesa kwenye bank💰", slug: "weka-pesa-kwenye-bank" },
    ],
  });
});

// Login page
app.get("/sign_in", (req, res) => {
  res.render("sign_in", {
    appName: "Aswito App",
    botUsername: process.env.TELEGRAM_BOT_USERNAME,
    pageTitle: "Sign In",
    description: "This is a login page to aunthenticate yourself as a real human.",
    siteName: "Aswito INC",
  });
});

app.post("/sign_in", async (req, res) => {
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

// For Vercel serverless
export default app;
// dev
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`App running on http://localhost:${PORT}`);
  });
}
