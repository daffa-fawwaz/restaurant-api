import http from "http";
import app from "./app.js";
import { initSocket } from "./socket/socket.js";

const port = 3002;

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

server.listen(port, () => {
  console.log(`Running on port : ${port}`);
});