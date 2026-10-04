import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useRef, useState } from "react";

import { copy } from "../copy";

/**
 * Our own picker (the vendor modal's text says "wallet", spec §3.3). Lists the account apps
 * found on the device by their own name; picking one connects it (WalletProvider autoConnect).
 */
export function ConnectButton({ label = copy.connect.connect }: { label?: string }) {
  const { connecting } = useWallet();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="primary" onClick={() => setOpen(true)} disabled={connecting}>
        {connecting ? copy.connect.connecting : label}
      </button>
      {open && <ConnectDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ConnectDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { wallets, select, connected, connecting } = useWallet();
  const usable = wallets.filter(
    (w) =>
      w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  );

  useEffect(() => {
    // No close() on cleanup: StrictMode's re-run would fire `close` and shut it at once;
    // unmounting removes the dialog anyway.
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  useEffect(() => {
    if (connected) onClose();
  }, [connected, onClose]);

  return (
    <dialog ref={ref} className="picker" onClose={onClose} aria-labelledby="picker-title">
      <h2 id="picker-title">{copy.connect.pickTitle}</h2>
      <p className="small">{copy.connect.pickIntro}</p>
      {usable.length === 0 ? (
        <p>{copy.connect.none}</p>
      ) : (
        <ul>
          {usable.map((w) => (
            <li key={w.adapter.name}>
              <button
                className="secondary app"
                disabled={connecting}
                onClick={() => select(w.adapter.name)}
              >
                <img src={w.adapter.icon} alt="" width={28} height={28} />
                {/burner/i.test(w.adapter.name) ? copy.connect.testAccount : w.adapter.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {connecting && <p className="small">{copy.connect.connecting}</p>}
      <button className="quiet-dark" onClick={() => ref.current?.close()}>
        {copy.common.close}
      </button>
    </dialog>
  );
}

export function DisconnectButton() {
  const { connected, disconnect } = useWallet();
  if (!connected) return null;
  return (
    <button className="quiet" title={copy.connect.connected} onClick={() => void disconnect()}>
      {copy.connect.disconnect}
    </button>
  );
}
