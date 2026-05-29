import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CryptoSeedsWalletProvider } from "./solana/CryptoSeedsWalletProvider";
import "./styles.css";
import "@solana/wallet-adapter-react-ui/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CryptoSeedsWalletProvider>
      <App />
    </CryptoSeedsWalletProvider>
  </StrictMode>,
);
