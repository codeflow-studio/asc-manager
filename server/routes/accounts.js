import { Router } from "express";
import { getAccounts, addAccount, deleteAccount } from "../lib/account-store.js";

const router = Router();

router.get("/", (_req, res) => {
  const accounts = getAccounts();
  res.json(
    accounts.map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
    }))
  );
});

router.post("/", (req, res) => {
  const { name, issuerId, keyId, privateKey, color } = req.body;
  if (!name || !issuerId || !keyId || !privateKey) {
    return res.status(400).json({ error: "Missing required fields: name, issuerId, keyId, privateKey" });
  }
  const account = addAccount({ name, issuerId, keyId, privateKey, color });
  res.status(201).json({ id: account.id, name: account.name, color: account.color });
});

router.delete("/:id", (req, res) => {
  const deleted = deleteAccount(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Account not found" });
  }
  res.status(204).end();
});

export default router;
