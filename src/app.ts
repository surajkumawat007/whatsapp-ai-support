import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./routes/api";

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: "*", // Adjust for specific origins in production
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log requests in development
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount Routes
app.use("/", apiRoutes);

// General Health Check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "WhatsApp AI Support Agent API",
    time: new Date().toISOString(),
    mode: process.env.OPENAI_API_KEY ? "Real OpenAI API" : "Fallback/Mock AI Agent"
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express Error Handler:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// Start Server
app.listen(port, () => {
  console.log(`🚀 WhatsApp AI Support Agent Backend running on port ${port}`);
});

export default app;
