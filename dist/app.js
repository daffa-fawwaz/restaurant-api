import express from "express";
import router from "./routes/index.js";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
const app = express();
app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
}));
app.use(express.json());
app.use("/api", router);
app.get("/", (_, res) => {
    res.send("Server OK");
});
export default app;
