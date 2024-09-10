import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();

const app = express();

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN }));

//Minhas rotas igual eu faço com o horse
app.get("/health", (req, res) =>
  res.send({
    message: `OK [${new Date()}] - App listening on port ${
      process.env.NODE_PORT
    }`,
  })
);
//this for route will need for store front, also for admin dashboard

// Use express's default error handling middleware
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(400).json({ message: err.message });
});

export default app;
