# M7 — jour J : build vérifié puis verrouillage

Préparé le 2026-10-04, **rien de tout ça n'est fait**. Hash on-chain actuel (binaire buildé hors docker) :
`5c2e4cd5d0ecae4e5abda1daf47d2e65385aa13f22e325eaa1e737744f2b3b1b`. Il ne correspondra pas au build
docker : il faut redéployer le build docker avant de vérifier (étape 4).

Prérequis : Docker lancé, `source .claude/hooks/env.sh`, ~3 SOL devnet sur le wallet de dev
(buffer de redéploiement, remboursé à la fin), branche `main` propre, **plus de travail sur programs/**.

1. **Dépôt public** : GitHub → Settings → Danger zone → Change visibility → Public.
   Vérifier qu'aucune branche poussée ne contient de clé (`git ls-files | grep -i key` vide).
2. `git push origin main` (le commit vérifié doit être sur GitHub).
3. **Build reproductible** : `scripts/verify-build.sh build` (image `solana-verifiable-build:4.1.2`,
   `--arch v2`). Premier lancement : 10–20 min (téléchargement de l'image). Note le hash affiché.
4. **Redéployer ce binaire** (même ID, même code) :
   `solana program deploy target/deploy/dniowka.so --program-id EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3 -u devnet`
   (ne pas relancer `anchor build` entre 3 et 4, il écraserait le .so).
5. `scripts/verify-build.sh compare` → les deux hash doivent être **identiques**. Sinon : stop.
6. **Rejouer la démo** : `pnpm run smoke` (≈ 2 min) doit finir sur `status settled`.
7. `scripts/verify-build.sh verify` → confirme l'upload (signé par l'upgrade authority), puis la
   vérification à distance (OtterSec). Contrôle :
   `solana-verify get-program-pda --program-id EhUq… -u devnet` et la page du programme sur
   https://explorer.solana.com/address/EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3?cluster=devnet
   (onglet « Verification ») ou https://verify.osec.io/status/EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3.
8. **Verrouillage (toi seul, irréversible)** :
   `solana program set-upgrade-authority EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3 --final -u devnet`
   Puis `solana program show EhUq… -u devnet` → `Authority: none`.
9. **README** : remplacer l'encadré « Status of the upgrade authority », la ligne « Us (the authors) » du
   tableau des permissions, la question « Can you change anything », la section « Verified build » et la
   limite « The program is still upgradeable » par : vérifié + non modifiable, avec le lien de vérification
   et la signature de la transaction `--final`. Commit + push.
