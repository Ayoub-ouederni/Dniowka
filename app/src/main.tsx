import "./index.css";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { RPC_URL } from "./chain/config";
import { PersistentBurnerAdapter } from "./chain/devBurner";
import { initLang } from "./lang";

initLang();

// Wallet Standard auto-detects Phantom / Solflare (and Mobile Wallet Adapter on Android over
// HTTPS); no legacy adapters. The throwaway burner exists only in dev with VITE_DEV_BURNER=1.
const wallets =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BURNER === "1"
    ? [new PersistentBurnerAdapter()]
    : [];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      {/* Failures are shown to the person by each screen; keep the console for real errors. */}
      <WalletProvider wallets={wallets} autoConnect onError={(e) => console.debug(e)}>
        <App />
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>,
);
