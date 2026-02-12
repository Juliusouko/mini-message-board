import express from "express";
import crypto from "crypto";
import cors from "cors";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import pool from "./config/db.js";

const app = express();
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const messages = [
  {
    text: "Hi there!",
    user: "Amando",
    added: new Date(),
  },
  {
    text: "Hello World!",
    user: "Charles",
    added: new Date(),
  },
];
let ejsH1 = "Welcome to MiniMessageBoard";
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    return res.sendStatus(204);
  }
  next();
});
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

function verifyTelegramAuth(data) {
  const botToken = "8199074353:AAHrKspVjppkLNgaahlFlnS66WHSayDGX_E";

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

app.use((req, res, next) => {
  console.log("Request received:", req.method, req.url);
  next();
});
app.post("/create", async (req, res) => {
  try {
    const data = req.body;

    if (!verifyTelegramAuth(data)) {
      return res.status(403).json({ success: false });
    }

    const { id, first_name, last_name, username } = data;

    // 1️⃣ Check if telegram auth already exists
    const existingAuth = await pool.query(
      `SELECT users.*
       FROM auth_providers
       JOIN users ON users.id = auth_providers.user_id
       WHERE provider = 'telegram'
       AND provider_user_id = $1`,
      [id],
    );

    let user;

    if (existingAuth.rows.length > 0) {
      user = existingAuth.rows[0];
      return res.json({ success: true, user: existingAuth.rows[0] });
    } else {
      // 2️⃣ Create new user
      const newUser = await pool.query(
        `INSERT INTO users (first_name, last_name, username)
       VALUES ($1, $2, $3)
       RETURNING *`,
        [first_name, last_name || null, username || null],
      );

      const userId = newUser.rows[0].id;

      // 3️⃣ Create telegram auth record
      await pool.query(
        `INSERT INTO auth_providers
       (user_id, provider, provider_user_id)
       VALUES ($1, 'telegram', $2)`,
        [userId, id],
      );
    }
    return res.json({
      success: true,
      user: newUser.rows[0],
    });

    return res.render("dashboard", { user });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
});

app.get("/", (req, res) => {
  res.render("index", { h1: ejsH1, messages: messages });
});
app.get("/login", (req, res) => {
  res.render("login", { h1: ejsH1 });
});
app.get("/message/:user", (req, res) => {
  const nameId = req.params.user.trim();
  const name = messages.find((i) => i.user === nameId);
  if (name) {
    res.render("messageDetails", { message: name });
  } else {
    res.status(404).send("Item not found");
  }
});
app.get("/new", (req, res) => {
  res.render("form", { h1: ejsH1 });
});
app.post("/new", (req, res) => {
  const { author, message } = req.body;
  messages.push({ text: message, user: author, added: new Date() });
  res.redirect("/");
});
app.get("/data", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users ORDER BY created_at DESC",
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error("Database query failed:", err);
    res.status(500).json({ success: false, message: "Failed to fetch data" });
  }
});
app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
