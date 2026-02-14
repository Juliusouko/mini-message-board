import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { router } from "./routes/newsletterRoutes.js"

const app = express();

// middleware
dotenv.config();
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Authorization"],
    // credentials: true, set for cookies
  }),
);

// mount routes
app.use('/subscribe', router);
export default app;

// dev
if (process.env.NODE_ENV !== "production") {
  app.listen(() => {
    console.log(`App running on http://localhost:${process.env.PORT}`);
  });
}
