import express from "express";
import dotenv from "dotenv";
import { router } from "./routes/newsletterRoutes.js";

const app = express();

// middleware
dotenv.config();
app.use(express.json());

// mount routes
app.use('/subscribe', router);
export default app;

// dev
if (process.env.NODE_ENV !== "production") {
  app.listen(() => {
    console.log(`App running on http://localhost:${process.env.PORT}`);
  });
}
