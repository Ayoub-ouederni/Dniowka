# Shared PATH for Solana/Anchor/Noir/Go toolchains (hooks run in a non-login shell)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$HOME/.cargo/bin:$HOME/.nargo/bin:$HOME/go/bin:/opt/homebrew/bin:$PATH"
export GNARK_VERIFIER_BIN="$HOME/.sunspot/gnark-solana/crates/verifier-bin"
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$ROOT" || exit 0
