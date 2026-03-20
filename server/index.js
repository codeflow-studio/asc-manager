import express from "express";
import accountsRouter from "./routes/accounts.js";
import appsRouter from "./routes/apps.js";
import productsRouter from "./routes/products.js";

const app = express();

app.use(express.json());

app.use("/api/accounts", accountsRouter);
app.use("/api/apps", appsRouter);
app.use("/api/apps", productsRouter);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`ASC proxy server running on http://localhost:${PORT}`);
});
