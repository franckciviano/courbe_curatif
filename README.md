# Simulateur de coût curatif — Clovis

Outil web 100 % local pour tracer et comparer la courbe du coût curatif total d'un contrat de maintenance Renault Trucks en fonction du kilométrage mensuel.

Aucun backend, aucun appel réseau (en dehors du chargement initial des polices Google Fonts). Les coefficients sont importés statiquement depuis `src/data/coefficients.json`.

## Lancement

```bash
npm install
npm run dev
```

Puis ouvrir l'URL indiquée par Vite (par défaut http://localhost:5173).

## Utilisation

- **Ajouter une courbe** : bouton « + Ajouter une courbe » dans le panneau de gauche.
- **Configurer** : pour chaque courbe, sélectionner en cascade Gamme → Moteur/Type → Silhouette → POC → Durée. Saisir les heures PMT.
- **Modifier le nom** : cliquer sur l'input nom en haut de la carte (l'auto-génération est désactivée après modification manuelle).
- **Masquer / afficher** : la checkbox de la carte ou un clic sur l'entrée correspondante dans la légende du graphique.
- **Supprimer** : icône poubelle en haut à droite de la carte.
- **Zoom** : molette de la souris sur le graphique, ou clic-glissé horizontal pour zoomer sur une plage X. Bouton « Réinitialiser le zoom » en haut à droite.

## Formule

```
Curatif = (km² × a) + (km × b) + c + (heures_PMT × 1.21) − (13 × durée)
```

Avec `c = 0` pour les gammes dont `has_c` vaut `false` (cas C 2.5).

## Mettre à jour les coefficients

Remplacer le fichier `src/data/coefficients.json` puis relancer `npm run dev`. Les listes déroulantes se reconstruisent automatiquement à partir du JSON, rien n'est codé en dur côté UI.

Structure attendue :

```json
{
  "gammes": {
    "NOM": {
      "classification_field": "moteur" | "type",
      "has_c": true | false,
      "entries": [
        { "moteur"|"type": "...", "silhouette": "...", "poc": "...",
          "duree": 48, "a": 0, "b": 0, "c": 0, "code": "..." }
      ]
    }
  }
}
```

## Stack

- React 18 + Vite
- Tailwind CSS
- Recharts
