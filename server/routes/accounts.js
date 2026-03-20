import { Router } from "express";
import { ACCOUNTS } from "../config/accounts.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(
    ACCOUNTS.map((a) => ({
      id: a.id,
      name: a.name,
      issuerId: a.issuerId,
      keyId: a.keyId,
      color: a.color,
    }))
  );
});

export default router;
