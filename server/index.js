import express from "express";
import accountsRouter from "./routes/accounts.js";
import appsRouter from "./routes/apps.js";
import productsRouter from "./routes/products.js";
import xcodeCloudRouter from "./routes/xcode-cloud.js";
import pricingRouter from "./routes/pricing.js";

const app = express();

app.use(express.json());

app.use("/api/accounts", accountsRouter);
app.use("/api/apps", appsRouter);
app.use("/api/apps", productsRouter);
app.use("/api/apps", pricingRouter);
app.use("/api/apps", xcodeCloudRouter);

const PORT = process.env.SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`ASC proxy server running on http://localhost:${PORT}`);
});
