import express from "express";
import subscribe from "../controllers/newsLetterController.js";

const router = express();

router.post('/subscribe', subscribe);

export { router };  