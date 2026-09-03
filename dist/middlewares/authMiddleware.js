import jwt from "jsonwebtoken";
import { error } from "../utils/response.js";
const JWT_SECRET = process.env.JWT_SECRET;
export const authMiddleware = (req, res, next) => {
    const bearer = req.headers.authorization;
    if (!bearer || !bearer.startsWith("Bearer ")) {
        return error(res, 401, "Unauthorized", "UNAUTHORIZED");
    }
    const token = bearer.split(" ")[1];
    if (!token) {
        return error(res, 401, "Unauthorized", "UNAUTHORIZED");
    }
    try {
        const secret = process.env.JWT_SECRET || "default_secret";
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch {
        return error(res, 401, "Invalid token", "UNAUTHORIZED");
    }
};
