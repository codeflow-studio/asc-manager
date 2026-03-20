import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { join } from "path";

function loadPrivateKey(account) {
  if (account.privateKey) {
    return account.privateKey;
  }
  const keyPath = join(process.cwd(), account.keyFile);
  return readFileSync(keyPath, "utf8");
}

export function generateToken(account) {
  const privateKey = loadPrivateKey(account);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: account.issuerId,
    iat: now,
    exp: now + 20 * 60,
    aud: "appstoreconnect-v1",
  };
  return jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    header: { alg: "ES256", kid: account.keyId, typ: "JWT" },
  });
}
