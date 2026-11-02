# Les Gardiens d’Aether

Jeu d’action-aventure 3D low poly jouable dans le navigateur, sur ordinateur et sur téléphone.

## Mission

Défends l’île suspendue de Verdant pendant quatre vagues. Les chargeurs poursuivent le gardien, les tourelles gardent leurs distances, les cristaux se divisent et le Gardien corrompu combine salves circulaires, tirs dirigés et renforts. Ramasse les éclats pour recharger le flux, gagner des points et acheter des améliorations entre les vagues.

## Commandes

### Ordinateur
- **WASD / flèches** : déplacement
- **Souris** : visée
- **Clic gauche maintenu** : tir
- **Espace / Maj** : dash avec courte invulnérabilité
- **E** : impulsion de zone, détruit aussi les projectiles ennemis
- **Échap / P** : pause
- **M** : son

### Téléphone
- **Joystick gauche** : déplacement
- **Joystick droit** : visée et tir
- **Boutons dédiés** : dash et impulsion

## Comptes et classement

Le mode invité permet de jouer immédiatement, sans classement. La connexion Kimi active la sauvegarde cloud du meilleur score, du nombre de parties, des victoires, de la meilleure vague et du total d’éclats. Chaque fin de partie connectée enregistre aussi un résultat détaillé et met à jour le classement mondial.

## Exécution

```bash
npm install
npm run db:push
npm run dev
```

Production :

```bash
npm run check
npm run build
npm start
```

## Techniques principales

- Three.js avec géométrie procédurale et variations déterministes
- Boucle de simulation fixe à 60 Hz, projectiles et particules en pools bornés
- Caméra isométrique, ombres directionnelles, brouillard et îles lointaines
- Effets sonores et musique synthétisés avec Web Audio
- React uniquement pour les menus et le HUD ; aucune re-création React par frame
- API Hono + tRPC, Drizzle ORM, MySQL et OAuth Kimi
- Dégradation automatique de la résolution et des ombres si la cadence reste faible
