import React from "react";
import ReactDOM from "react-dom/client";
import AppStoreManager from "./components/AppStoreManager.jsx";
import "./main.css";

document.title = __APP_TITLE__;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppStoreManager />
  </React.StrictMode>
);
