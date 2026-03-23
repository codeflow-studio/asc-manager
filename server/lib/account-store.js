import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.ASC_DATA_DIR || join(process.cwd(), "data");
const ACCOUNTS_FILE = join(DATA_DIR, "accounts.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAccounts() {
  ensureDataDir();
  if (!existsSync(ACCOUNTS_FILE)) {
    return [];
  }
  const raw = readFileSync(ACCOUNTS_FILE, "utf8");
  try {
    const accounts = JSON.parse(raw);
    if (!Array.isArray(accounts)) {
      console.warn("accounts.json does not contain an array, returning empty list");
      return [];
    }
    return accounts;
  } catch (err) {
    console.warn("Failed to parse accounts.json:", err.message);
    return [];
  }
}

function writeAccounts(accounts) {
  ensureDataDir();
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf8");
}

export function getAccounts() {
  return readAccounts();
}

export function addAccount({ name, issuerId, keyId, privateKey, color }) {
  const accounts = readAccounts();
  const account = {
    id: Date.now().toString(),
    name,
    issuerId,
    keyId,
    privateKey,
    color,
  };
  accounts.push(account);
  writeAccounts(accounts);
  return account;
}

export function deleteAccount(id) {
  const accounts = readAccounts();
  const index = accounts.findIndex((a) => a.id === id);
  if (index === -1) return false;
  accounts.splice(index, 1);
  writeAccounts(accounts);
  return true;
}
