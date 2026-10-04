import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { copy } from "../copy";

/** Our own button text; the vendor picker it opens is replaced by a custom one in M4. */
export function ConnectButton({ label = copy.connect.connect }: { label?: string }) {
  const { connecting } = useWallet();
  const { setVisible } = useWalletModal();
  return (
    <button className="primary" onClick={() => setVisible(true)} disabled={connecting}>
      {label}
    </button>
  );
}

export function DisconnectButton() {
  const { connected, disconnect } = useWallet();
  if (!connected) return null;
  return (
    <button className="quiet" onClick={() => void disconnect()}>
      {copy.connect.connected} · {copy.connect.disconnect}
    </button>
  );
}
