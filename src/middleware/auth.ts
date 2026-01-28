import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { config } from "../config";

const jwks = jwksClient({ jwksUri: config.jwksUrl });

function getKey(header: any, cb: any) {
  jwks.getSigningKey(header.kid, (err, key) => {
    cb(err, key?.getPublicKey());
  });
}

export function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "NO_TOKEN" });

  const token = auth.replace("Bearer ", "");
  jwt.verify(token, getKey, {}, (err, decoded) => {
    if (err) return res.status(401).json({ message: "INVALID_TOKEN" });
    req.user = decoded;
    next();
  });
}