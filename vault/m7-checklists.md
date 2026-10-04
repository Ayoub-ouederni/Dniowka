# M7 — checklists vidéo de secours et rendu

## Avant d'enregistrer (ou avant le live)
- [ ] Wallets devnet approvisionnés en SOL (faucet.solana.com) : employeur (Phantom laptop), employé
      (Phantom téléphone), un 3ᵉ wallet « n'importe qui » pour le payday.
- [ ] `pnpm run reset-demo` puis `APP_URL=https://dniowka.vercel.app pnpm run seed:demo -- --employee <adresse téléphone>`
      (APP_URL : sinon les liens affichés pointent vers localhost)
      (payday de Marek dans 5 min : lancer ~4 min avant la scène payday, ou `PAYDAY_IN=8`).
- [ ] Ouvrir le lien « labels » affiché par seed:demo sur le laptop du grand écran.
- [ ] Onglets prêts : https://dniowka.vercel.app (employeur), grand écran, Explorer du programme.
- [ ] Téléphone : ouvrir le lien d'invitation dans le navigateur de Phantom (iOS) ou Chrome (Android).
- [ ] Répétition rapide (5 min) de retrait réel sur la version en ligne, depuis le téléphone.

- [ ] **RPC :** le devnet public renvoie souvent des 429 (premier chargement ~30 s au test du
      04.10). Fermer les onglets inutiles ; si ça rame, une clé RPC gratuite (Helius) + redeploy avec
      `VITE_RPC_URL=… scripts/deploy-app.sh` règle le problème.

## Vidéo de secours (≤ 3 min, scénario §9 sans l'étape ZK)
| Temps | Écran | Action | Phrase |
|---|---|---|---|
| 0:00–0:20 | titre / laptop | contexte | « Le 12, Oksana a déjà gagné 40 % de son salaire, mais elle ne peut pas y toucher : alors elle prend une chwilówka. » |
| 0:20–0:45 | employeur | « Secure October payroll », 6 000 zł, clic proof ↗ | « L'employeur bloque le salaire net dans un coffre on-chain. » |
| 0:45–1:05 | téléphone | ouvrir l'invitation, rejoindre, les coupons se remplissent | « Chaque minute = un jour de travail. » |
| 1:05–1:35 | téléphone, jour 12 | gagné 2 400, dispo 1 680 → prendre 800 zł, coupon déchiré, proof ↗ | « Pas de prêteur, pas d'approbation, 0 zł de frais. » |
| 1:35–1:55 | téléphone | tenter 5 000 zł → « Try anyway » → ODMOWA, proof ↗ montre l'échec on-chain | « Impossible d'emprunter ce qu'on n'a pas gagné. C'est le programme qui refuse. » |
| 1:55–2:15 | employeur | fin de contrat hier → ODMOWA | « On ne peut pas antidater un licenciement pour reprendre un salaire gagné. » |
| 2:15–2:45 | grand écran + 3ᵉ wallet | compte à rebours à 0, « Run payday » depuis un wallet étranger → WYPŁACONO | « Le jour de paie s'exécute tout seul, n'importe qui peut le déclencher. » |
| 2:45–3:00 | Explorer | page du programme | Avant verrouillage : « Le programme sera vérifié et rendu non modifiable avant le rendu. » Après : « Vérifié, non modifiable. Personne ne peut changer la règle, pas même nous. » |

- [ ] Enregistré en 1080p, son clair, ≤ 3:00, liens Explorer visibles au moins une fois.
- [ ] Mis en ligne (YouTube non répertorié ou Loom) et lien ajouté au README et au formulaire.

## Rendu
- [ ] **Titre :** « Dniówka — salary vault: take earned wages any day, payday runs itself »
- [ ] **Description courte (≈ 300 caractères) :** « Dniówka replaces payday lenders and wage-advance
      apps with a Solana program. The employer locks net pay in a vault; the worker withdraws what
      they've already earned, instantly and for free; payday pays itself and anyone can trigger it.
      Built for small Polish businesses and their (often foreign) workers. »
- [ ] **Slides (≤ 10) :** 1 titre + une phrase · 2 problème (chwilówki, données BIK) · 3 utilisateur
      cible (Oksana, boulangerie) · 4 l'intermédiaire et ce qui le remplace · 5 comment ça marche (coffre,
      gagné, plancher, payday) · 6 où vivent les règles (withdraw_earned / settle / end_employment, liens) ·
      7 contraintes réelles (art. 84, 85, plancher) · 8 qui peut faire quoi + scénarios d'échec · 9 limites
      honnêtes · 10 une semaine de plus + liens (appli, dépôt, programme, vidéo).
- [ ] **Dépôt public** (après vault/m7-jour-j.md étape 1) ; README à jour après le verrouillage.
- [ ] Liens à coller : https://dniowka.vercel.app · https://github.com/Ayoub-ouederni/Dniowka ·
      programme sur Explorer · vidéo.
- [ ] Jour J : vault/m7-jour-j.md (build vérifié, puis `--final` par toi).
