import { Server } from "socket.io";
let io;
export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:5175",
            ],
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        },
    });
    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id);
        socket.on("join_order", (orderId) => {
            const room = `order:${orderId}`;
            socket.join(room);
            console.log(`Socket ${socket.id} joined ${room}`);
        });
        socket.on("leave_order", (orderId) => {
            const room = `order:${orderId}`;
            socket.leave(room);
            console.log(`Socket ${socket.id} left ${room}`);
        });
        socket.on("disconnect", () => {
            console.log("Socket disconnected:", socket.id);
        });
    });
    console.log("Socket.IO initialized");
    return io;
};
export const getIO = () => {
    if (!io) {
        throw new Error("Socket.IO has not been initialized");
    }
    return io;
};
