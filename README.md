# Suivi Commercial — Team Franchise Adzopé

Application locale (fonctionne dans le navigateur, sans connexion internet) inspirée de vos
deux fichiers Excel :

- `REAL ANNEE 2026 adz PH.xlsx` → onglets **Tableau de bord** et **Objectifs**
- `TEMPLATE 2026 ABO 4G HOME AN 2026 FR ADZOPE.xls` → onglet **Abonnements 4G Home**

Elle remplace la saisie manuelle des totaux/GAP/% par des calculs automatiques, et fait le lien
entre le registre des abonnements 4G Home et les objectifs correspondants (plus besoin de
compter les ventes deux fois).

## Démarrer l'application

Double-cliquez sur **`Lancer l'application.bat`**. Une fenêtre noire s'ouvre (ne pas la fermer
tant que vous utilisez l'application) et votre navigateur s'ouvre automatiquement sur
`http://localhost:5173`.

Pour arrêter : fermez simplement la fenêtre noire, ou faites `Ctrl+C` dedans.

> Prérequis : Node.js doit être installé sur l'ordinateur (déjà le cas si l'application a été
> installée par un technicien). Sans Node.js, le double-clic n'ouvrira pas l'application.

## Les 5 onglets

1. **Tableau de bord** — Objectif vs réalisé par produit, pour l'équipe entière ou un vendeur,
   par mois / trimestre / année.
2. **Objectifs** — Saisie de l'objectif mensuel et des ventes de chaque semaine, par vendeur et
   par produit. La ligne **4G Home** est calculée automatiquement à partir du registre
   d'abonnements (onglet suivant) : elle n'est pas modifiable ici.
3. **Abonnements 4G Home** — Le registre détaillé (un abonnement = une ligne), avec recherche et
   filtres. C'est ici qu'on enregistre chaque nouvelle souscription.
4. **Équipe & Points de vente** — Gestion de la liste des vendeurs et des points de vente.
5. **Export / Sauvegarde** — Exporter en Excel, sauvegarder/restaurer les données, importer
   d'anciens fichiers Excel d'abonnements.

## Où sont stockées les données ?

Les données sont enregistrées **dans ce navigateur, sur cet ordinateur** (pas envoyées sur
internet). Si vous videz le cache du navigateur ou changez d'ordinateur, vous perdrez les
données à moins d'avoir exporté une sauvegarde.

**Conseil : exportez une sauvegarde (.json) régulièrement** depuis l'onglet
« Export / Sauvegarde », et gardez le fichier dans OneDrive/Documents. En cas de souci, vous
pourrez tout restaurer avec « Choisir un fichier » dans le même onglet.

## Importer vos anciennes données Excel

Dans l'onglet Export / Sauvegarde, section « Importer des abonnements 4G Home depuis un fichier
Excel » : sélectionnez un de vos anciens fichiers mensuels, choisissez la feuille du mois, vérifiez
l'aperçu, puis cliquez sur « Importer ces lignes ». L'outil détecte automatiquement les colonnes
habituelles, mais si un fichier a une mise en page inhabituelle, vérifiez toujours l'aperçu avant
de confirmer.

## Version en ligne (Vercel)

L'application est un site statique (HTML/CSS/JS) : elle peut être hébergée sur Vercel sans
aucune modification et sans `server.js` (celui-ci ne sert que pour l'usage local via le fichier
`.bat`). Une fois déployée, une URL du type `https://votre-projet.vercel.app` donne accès à
l'application depuis n'importe quel navigateur.

**Important : les données restent stockées dans le navigateur qui les saisit**, même en ligne.
Si vous ouvrez toujours l'URL Vercel depuis le même ordinateur/navigateur, tout fonctionne comme
en local. Si plusieurs personnes doivent voir les mêmes données depuis des appareils différents,
il faudra ajouter une vraie base de données partagée — ce n'est pas le cas actuellement.

Étapes : le code est poussé sur un dépôt GitHub, puis importé une fois dans Vercel
(vercel.com → *Add New* → *Project* → sélectionner le dépôt → *Deploy*, aucune configuration de
build nécessaire). Chaque mise à jour poussée sur GitHub redéploie automatiquement le site.

## Modifier les produits suivis

La liste des produits (Packs, Cofina, 4G Home, Fibre Up, QR Code, Max-it, Carte Oba, Carte
virtuelle OBA, Fréquentation, Client mystère, Évaluation) est reprise de votre fichier de
récapitulatif annuel. Pour l'instant, la modification de cette liste se fait en modifiant le
fichier `js/store.js` (section `DEFAULT_PRODUCTS`) — demandez à votre technicien si besoin.
