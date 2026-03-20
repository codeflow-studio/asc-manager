import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { join } from "path";

const tokenCache = new Map();
const TOKEN_MARGIN_SEC = 2 * 60; // reuse tokens until 2 min before expiry

function loadPrivateKey(account) {
  if (account.privateKey) {
    return account.privateKey;
  }
  const keyPath = join(process.cwd(), account.keyFile);
  return readFileSync(keyPath, "utf8");
}

export function generateToken(account) {
  const cached = tokenCache.get(account.keyId);
  const now = Math.floor(Date.now() / 1000);

  if (cached && cached.exp - TOKEN_MARGIN_SEC > now) {
    return cached.token;
  }

  const privateKey = loadPrivateKey(account);
  const exp = now + 20 * 60;
  const payload = {
    iss: account.issuerId,
    iat: now,
    exp,
    aud: "appstoreconnect-v1",
  };
  const token = jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    header: { alg: "ES256", kid: account.keyId, typ: "JWT" },
  });

  tokenCache.set(account.keyId, { token, exp });
  return token;
}
