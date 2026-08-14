import express from "express";
import router from "./routes/index.js";
import dotenv from "dotenv";
import { supabase } from "./config/supabase";
import cors from "cors";
dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5174",
  }),
);

const port = 3001;

app.use(express.json());
app.use("/api", router);


app.get("/", (_, res) => {
  res.send("Server OK");
});

app.listen(port, () => {
  console.log(`Running on port : ${port}`);
});
