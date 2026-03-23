import express from "express";
import {
  accountsRouter,
  appsRouter,
  productsRouter,
  xcodeCloudRouter,
  pricingRouter,
  screenshotsRouter,
} from "./routes/index.js";

const app = express();

app.use(express.json());

app.use("/api/accounts", accountsRouter);
app.use("/api/apps", appsRouter);
app.use("/api/apps", productsRouter);
app.use("/api/apps", pricingRouter);
app.use("/api/apps", xcodeCloudRouter);
app.use("/api/apps", screenshotsRouter);

const PORT = process.env.SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`ASC proxy server running on http://localhost:${PORT}`);
});
