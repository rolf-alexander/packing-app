# Packlist

A packing and gear app for my gap year: gear inventory, packing lists per trip and bag, airline weight limits, carry-on battery checks, a daily pre-tour checklist, trip admin tasks and a shopping list.

**Live app:** https://rolf-alexander.github.io/packing-app/

It's a progressive web app (PWA): a website that installs on the iPhone home screen, works fully offline and keeps all data **on the phone only** (in the browser's IndexedDB database). Nothing is sent to a server.

## Install on iPhone

1. Open the link above in **Safari**. Other browsers can't install web apps on iPhone.
2. Tap the **Share** button (square with an arrow), then **Add to Home Screen**, then **Add**.
3. Open Packlist from the home screen icon. It now runs full screen and works with no signal.

Your data belongs to the home-screen app. If you also open the site in a Safari tab, that tab has its own separate data.

## Backing up (do this regularly!)

Your data lives only on the phone. If you delete the app or lose the phone, the data goes with it.

- **More → Save full backup (JSON)**. In the share sheet, choose **Save to Files** and pick iCloud Drive. This saves everything, including photos.
- To restore (for example on a new phone): **More → Restore from backup** and pick the file. This replaces everything in the app.
- The More screen shows when you last backed up, and warns you after 14 days.

Spreadsheet exports (CSV) are also in More: gear list, all packing lists, and the shopping list (for the spending tracker). You can import a gear CSV. It adds new items and updates items with the same name. Files with comma or semicolon separators both work.

## Updating the app

The app files live in this folder and on GitHub. To change something:

1. Edit the files (see "How the code is organised" below).
2. **Open `sw.js` and bump `VERSION`** (for example `'v1'` → `'v2'`). This is what tells phones to download the new files. If you skip it, phones keep using the old cached version.
3. If you added a new file, add it to the `FILES` list in `sw.js` too.
4. Publish:
   ```
   git add -A
   git commit -m "Describe the change"
   git push
   ```
5. GitHub Pages updates in about a minute. Next time you open the app with internet, a message says **"A new version of the app is ready"**. Tap **Update**. Your data is not affected by updates.

To try changes on your computer first, run `python -m http.server 8000` in this folder and open http://localhost:8000.

## How the code is organised

No build step and no libraries: plain HTML, CSS and JavaScript.

| File | What it does |
| --- | --- |
| `index.html` | The page shell |
| `css/styles.css` | All styling, including the dark mode colours at the top |
| `js/app.js` | Start-up and navigation between screens |
| `js/store.js` | Saving and loading data (IndexedDB) |
| `js/model.js` | Packing rules: bag weights, limits, carry-on checks |
| `js/seed.js` | The starter gear, trips, templates, admin tasks and pre-tour checks |
| `js/views/*.js` | One file per screen: trips, gear, pre-tour check, shop, more/templates/search |
| `js/forms.js` | The gear editor and item picker |
| `js/backup.js` | JSON backup/restore and CSV export/import |
| `sw.js` | Service worker: stores the app on the phone for offline use |
| `manifest.webmanifest`, `icons/` | App name and icons for the home screen |
