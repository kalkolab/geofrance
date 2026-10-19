# GeoFrance

Track the French communes, departments and regions you have visited, on a map and with statistics.
It runs entirely in your browser: visits are stored on your device (IndexedDB) and nothing is sent to a server.

Live site: https://kalkolab.github.io/geofrance/

## What works today

- Department and region maps of mainland France (Corsica included), coloured by what you have visited.
- Tap the map to see which commune is there and mark it as visited.
- Add a visit by searching a city name or postcode, with an optional date and note.
- Statistics: communes, departments and regions visited, completion per region, and a list of your visits.
- Export, import and delete your visits. Installable as an app on Android (PWA) and usable offline once loaded.

Planned next: Google Maps Timeline import, Google Photos import (via Google Takeout), Google sign-in with Drive backup.

## Develop

```sh
npm install
npm run build:geo   # downloads boundaries and writes public/data (about 12 MB, not committed)
npm run dev         # http://localhost:5173/geofrance/
npm test
npm run build
```

## Deploy

Every push to `main` builds the site and publishes it to GitHub Pages through `.github/workflows/deploy.yml`.
Pull requests run the same build and tests without deploying. One-time setup: in the repository settings,
under Pages, set Source to "GitHub Actions".

## Data

- Codes and names of communes, departments and regions: INSEE COG via [`@etalab/decoupage-administratif`](https://github.com/etalab/decoupage-administratif).
- Boundaries: IGN ADMIN EXPRESS (2018 edition, simplified) via [france-geojson](https://github.com/gregoiredavid/france-geojson), Licence Ouverte.
  Shapes of communes merged since 2018 are reassigned to the commune they now belong to; 42 of the 34,746 current
  communes have no shape and can only be added by search.
- A GPS point is matched to a commune offline: point-in-polygon on the departments, then on that department's
  communes, with a 2 km tolerance for coastlines cut short by the simplified boundaries.
