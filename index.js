import express from "express";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index", { h1: ejsH1, messages: messages });
});
app.get("/login", (req, res) => {
  res.render("login", { h1: ejsH1 });
});
app.post("/login", (req, res) => {
  console.log(req.body);
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
app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});
