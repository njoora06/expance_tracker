# FinTrack

FinTrack is a customer ledger app for small businesses, built with **Expo (SDK 57)** and **React Native**. It keeps track of money given to and received from each customer, shows running balances, and exports reports to Excel.

The app is **fully offline**. Every account, customer and transaction is stored in a SQLite database on the phone. There is no backend server, and nothing is sent over the network unless the user chooses to share or export a file.

## Features

- **Accounts:** sign up and log in with email and password. Several accounts can exist on one device.
- **Forgot password:** verified with the phone's own screen lock (fingerprint, face, PIN or pattern). No email or internet needed.
- **Customers:** add, edit, delete and search. The list shows 7 customers per page.
- **Transactions:** credit (given) and debit (received), with date, time, payment method and notes. Running balances recalculate automatically.
- **Dashboard:** totals, today's activity and the 3 most recent customers.
- **Reports:** daily, weekly, monthly, yearly or a custom date range, per customer or across all customers.
- **Excel export:** a pivot-style **Summary** sheet (by customer, month, payment method, and a month × payment-method table, with live `SUM` totals) plus a **Transactions** sheet.
- **Backup & restore:** writes a `.json` backup, which the user can save to a folder of their choice (e.g. Download) or share. Restore imports it back.
- **UI:** light and dark mode, toast notifications, themed confirmation dialogs and an animated splash screen.

## Tech stack

| Area | Library |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Navigation | Expo Router (file-based routes in `src/app`) |
| Database | `expo-sqlite` |
| Files & sharing | `expo-file-system`, `expo-sharing` |
| Excel | `xlsx` (SheetJS) |
| Device verification | `expo-local-authentication` |
| Animation & graphics | `react-native-reanimated`, `react-native-svg` |
| Toasts | `sonner-native` |
| Language | TypeScript |

## Getting started

### Requirements

- Node.js (the project was set up with Node 26 and npm 12)
- An Android phone with **Expo Go** installed from the Play Store, or an Android emulator

### Install and run

```bash
npm install
npm start          # same as: npx expo start
```

Then do one of the following:
- **Phone on the same Wi-Fi:** open Expo Go and scan the QR code shown in the terminal.
- **Phone over USB:** press `a` in the terminal. See [USB debugging](#usb-debugging-android) below.
- **Browser:** press `w`. The app is mobile-first; password reset and backup restore are not available on web.

Keys in the dev server terminal:

| Key | Action |
|---|---|
| `r` | Reload the app |
| `a` | Open on Android |
| `w` | Open in the browser |
| `j` | Open the debugger |

If something behaves oddly after updating packages, restart with the cache cleared:

```bash
npx expo start -c
```

### USB debugging (Android)

1. On the phone, enable **Developer options** (tap *Build number* 7 times in *About phone*), then turn on **USB debugging**. Turn **USB tethering off**.
2. On Linux, install adb, add yourself to the `adbusers` group, then log out and back in:
   ```bash
   sudo pacman -S android-tools android-udev   # Arch / Garuda
   sudo usermod -aG adbusers $USER
   ```
3. Plug in the phone, accept the "Allow USB debugging?" prompt, and check that it's listed:
   ```bash
   adb devices
   ```
4. Run `npm start` and press `a`.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` | Start and open on Android |
| `npm run web` | Start and open in the browser |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type-check the project |
| `npx expo-doctor` | Check the project setup and dependency versions |

> ⚠️ **Do not run `npm run reset-project`.** It's left over from the Expo template and moves the entire app out of `src/app`.

## Project structure

```
src/
├── app/                      # Screens (Expo Router: file = route)
│   ├── _layout.tsx           # Root: providers, toasts, animated splash
│   ├── index.tsx             # Redirects to login or dashboard
│   ├── (auth)/               # login, sign-up, forgot-password, reset-password
│   ├── (tabs)/               # dashboard, add-customer, customers, reports, settings
│   └── customer/             # [id] (ledger), add-transaction (modal screens)
├── components/ui/            # AnimatedSplash, BackupSheet, ConfirmDialog, CustomerCard, charts…
├── store/
│   ├── database.ts           # SQLite connection + schema migrations
│   ├── storage.ts            # Customers, transactions, reports, backup/restore data
│   ├── auth.ts               # Register, login, sessions, password reset
│   ├── AuthContext.tsx       # Logged-in user state
│   └── ThemeContext.tsx      # Theme + currency settings
├── utils/
│   ├── export.ts             # Excel export (Summary pivot sheet + Transactions)
│   ├── backup.ts             # Backup files: create, save to device, share, pick for restore
│   ├── notify.ts             # Toast helper (success / error / info / promise)
│   └── helpers.ts            # Currency and date formatting
├── hooks/                    # useAuth, useTheme, useSettings…
└── constants/theme.ts        # Colours (incl. primary / success / danger), spacing, fonts
assets/images/                # logo.png, icon.png, splash-icon.png, Android icon, favicon
```

## How it works

### Data storage

- Everything lives in a single SQLite file, `fintrack.db`, in the app's private storage. **Never rename it**: a new name would open an empty database and the user's data would appear lost.
- Schema changes go in `MIGRATIONS` in `src/store/database.ts`, tracked with `PRAGMA user_version`. Only **add** new migrations, and keep them additive (new tables, `ALTER TABLE … ADD COLUMN`). Never edit a migration that has shipped, never drop tables, and never delete the database.
- Uninstalling the app deletes all data. Encourage users to keep a backup saved outside the app.

### Backup & restore

Settings → **Create Backup** writes `fintrack_backup_<date>_<time>.json` to the app's storage (the newest 5 are kept), then offers:
- **Save to device:** pick a folder (e.g. Download) through the Android folder picker.
- **Share / Open:** send the file to Drive, WhatsApp, email and so on.

Settings → **Restore from Backup** picks a backup file, shows what it contains, and imports it after the user confirms.

### Forgot password

Login → Forgot Password → enter email → the phone's screen-lock prompt opens automatically → **Create New Password**.

Only a successful screen-lock check unlocks the reset. That permission is kept in memory only, works once, and expires after 10 minutes. If the phone has no screen lock, the app asks the user to set one up first.

### Splash screen

There are two stages, designed to look like a single screen:
1. **Native splash** (`app.json` → `expo-splash-screen`, image `assets/images/splash-icon.png`): the logo in a frosted circle with a soft glow on navy `#050914`. Android only allows a solid colour plus a centred icon here.
2. **Animated splash** (`src/components/ui/AnimatedSplash.tsx`): starts from exactly that picture, then fades in the gradient, a breathing glow and expanding ripples. It stays for at least 1.8 s and until the login check finishes.

If you change the logo or circle size, update **both** `splash-icon.png` and the size constants in `AnimatedSplash.tsx` so the hand-off stays seamless.

## Building the APK

APKs are built in the cloud with **EAS Build**, so Java and the Android SDK aren't needed locally.

```bash
npm install -g eas-cli        # or prefix each command with: npx eas-cli
eas login
eas init                      # first time only: links the project to your Expo account
eas build --profile preview --platform android
```

- The `preview` profile in `eas.json` produces an installable **APK**; `production` produces an **app bundle (AAB)** for the Play Store.
- On the first build, answer **Yes** to *Generate a new Android Keystore*. Expo stores it on your account.
- When the build finishes, open the link or scan the QR code on the phone to download and install the APK.

> 🔑 **Always build with the same Expo account.** Android only accepts updates signed with the same keystore. A different keystore forces users to uninstall the app, which **deletes their data**. Back the keystore up with `eas credentials`.

If `npm install -g` fails with `EACCES`, don't use `sudo`. Either use `npx eas-cli …`, or point npm's global folder at your home directory (`npm config set prefix ~/.npm-global` and add `~/.npm-global/bin` to your `PATH`).

> Expo Go doesn't use the app's icon or native splash. Build an APK to see the app exactly as users will.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails with `EALLOWGIT` | npm 12 blocks git dependencies. Install from the npm registry instead (e.g. `@react-native-community/datetimepicker@9.1.0`). |
| `Failed to resolve the Android SDK path` | Expo only needs `adb`. Run `mkdir -p ~/Android/Sdk/platform-tools && ln -sf /usr/bin/adb ~/Android/Sdk/platform-tools/adb`. |
| `adb devices` lists nothing | Turn on USB debugging, turn off USB tethering, set the USB mode to *File transfer*, accept the prompt on the phone, then run `adb kill-server && adb devices`. |
| `NativeDatabase.prepareAsync has been rejected` | Check the terminal for the logged `Caused by:` reason. If an old database is the cause, clear Expo Go's storage, which deletes the test data. |
| `Experience with id … does not exist` (EAS) | The `projectId` in `app.json` belongs to another account. Remove `expo.extra.eas` and run `eas init`. |
| Package version warnings | `npx expo install --check`, then `npx expo install --fix` |

## Notes for contributors

- Read the versioned Expo docs before changing code: <https://docs.expo.dev/versions/v57.0.0/>
- Show user feedback with `notify` (`src/utils/notify.ts`) and confirm destructive actions with `useConfirm()` (`src/components/ui/ConfirmDialog.tsx`). Don't use `Alert.alert`.
- Add package dependencies with `npx expo install <package>` so the versions match the SDK.
- Before building: `npx tsc --noEmit`, `npm run lint` and `npx expo-doctor`.
