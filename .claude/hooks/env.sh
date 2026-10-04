# Shared PATH for Solana/Anchor/Noir/Go toolchains (hooks run in a non-login shell)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$HOME/.cargo/bin:$HOME/.nargo/bin:$HOME/go/bin:/opt/homebrew/bin:$PATH"
export GNARK_VERIFIER_BIN="$HOME/.sunspot/gnark-solana/crates/verifier-bin"
# Anchor 1.2 builds SBPF v3 by default; LiteSVM 0.10 (our test runtime) only loads v2.
# Devnet accepts v2, so tests and deploys use the same binary.
export ANCHOR_BUILD_SBF_ARCH=v2
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$ROOT" || exit 0
