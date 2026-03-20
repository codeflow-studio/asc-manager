import { generateToken } from "./auth.js";

export async function ascFetch(account, path) {
  const token = generateToken(account);
  const url = `https://api.appstoreconnect.apple.com${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ASC API ${res.status}: ${body}`);
  }
  return res.json();
}
