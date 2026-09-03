import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

export interface JwtPayload {
  id: number;
  email: string;
}

export const generateToken = (payload: JwtPayload) => {
  const secret = process.env.JWT_SECRET || "default_secret";
  return jwt.sign(payload, secret, {
    expiresIn: "1d",
  });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};