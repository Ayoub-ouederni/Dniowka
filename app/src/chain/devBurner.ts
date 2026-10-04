/**
 * DEV ONLY (VITE_DEV_BURNER=1): Wallet Adapter's throwaway burner, but keeping its key in this
 * browser origin's localStorage so a funded test account survives a page reload. Never enabled
 * in a normal build. Use different origins (localhost / 127.0.0.1 / LAN IP) for different people.
 */
import { UnsafeBurnerWalletAdapter } from "@solana/wallet-adapter-unsafe-burner";
import { Keypair } from "@solana/web3.js";

const KEY = "dniowka:dev-burner";

export class PersistentBurnerAdapter extends UnsafeBurnerWalletAdapter {
  async connect(): Promise<void> {
    let keypair: Keypair;
    const saved = localStorage.getItem(KEY);
    if (saved) {
      keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved) as number[]));
    } else {
      keypair = Keypair.generate();
      localStorage.setItem(KEY, JSON.stringify(Array.from(keypair.secretKey)));
    }
    (this as unknown as { _keypair: Keypair })._keypair = keypair;
    this.emit("connect", keypair.publicKey);
  }
}
