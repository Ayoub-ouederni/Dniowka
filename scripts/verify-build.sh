#!/usr/bin/env bash
# Verified build for the Dniówka program. NOT run yet: the day-J steps are in
# vault/m7-jour-j.md. Upgrade-authority removal (--final) is done by the author, never here.
#
#   scripts/verify-build.sh build    reproducible docker build (SBPF v2), prints its hash
#   scripts/verify-build.sh compare  hash of the local docker build vs the program on devnet
#   scripts/verify-build.sh verify   upload verify data + remote verification (repo must be public,
#                                    HEAD pushed, deployed binary = the docker build)
#
# Why the flags: every build of this repo targets SBPF v2 (ANCHOR_BUILD_SBF_ARCH=v2, see
# vault/architecture.md), while solana-verify defaults to v0. The image is pinned to the local
# Solana CLI (4.1.2) the program was built and deployed with.
set -euo pipefail
cd "$(dirname "$0")/.."

PROGRAM_ID="EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3"
LIB="dniowka"
ARCH="v2"
IMAGE="solanafoundation/solana-verifiable-build:4.1.2"
REPO="https://github.com/Ayoub-ouederni/Dniowka"
URL="https://api.devnet.solana.com"

case "${1:-}" in
  build)
    solana-verify build --arch "$ARCH" --base-image "$IMAGE" --library-name "$LIB"
    solana-verify get-executable-hash "target/deploy/$LIB.so"
    ;;
  compare)
    echo "local : $(solana-verify get-executable-hash "target/deploy/$LIB.so")"
    echo "devnet: $(solana-verify get-program-hash -u "$URL" "$PROGRAM_ID")"
    ;;
  verify)
    COMMIT="$(git rev-parse HEAD)"
    git fetch -q origin && git branch -r --contains "$COMMIT" | grep -q . \
      || { echo "commit $COMMIT is not pushed" >&2; exit 1; }
    solana-verify verify-from-repo "$REPO" \
      -u "$URL" \
      --program-id "$PROGRAM_ID" \
      --library-name "$LIB" \
      --commit-hash "$COMMIT" \
      --arch "$ARCH" \
      --base-image "$IMAGE" \
      --remote
    ;;
  *)
    sed -n 2,12p "$0"
    exit 1
    ;;
esac
