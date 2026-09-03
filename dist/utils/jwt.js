import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
export const generateToken = (payload) => {
    const secret = process.env.JWT_SECRET || "default_secret";
    return jwt.sign(payload, secret, {
        expiresIn: "1d",
    });
};
export const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};
