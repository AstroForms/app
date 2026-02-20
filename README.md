# AstroForms

AstroForms ist eine Social-Community-Plattform mit Channels, Posts, Kommentaren, Reactions, Bot-Automationen und Admin/Moderation-Funktionen.

Dieses Repository ist **Open Source** und die Anwendung wird **produktiv eingesetzt**.

## Features

- Benutzerkonten mit NextAuth
- Profile, Follows und private Einstellungen
- Channels mit Rollen (Member, Moderator, Admin, Owner)
- Posts mit Likes, Saves, Remixes und Link-/Bild-Inhalten
- Kommentare mit:
  - Antworten (Threading)
  - Emoji-Reactions
- Nachrichten/DM-System
- Bot-System inkl. Regeln und Automationen
- Admin- und Trust/Safety-Tools (Reports, Bans, Moderation)

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Prisma ORM
- MySQL/MariaDB
- NextAuth (Auth.js)
- Tailwind CSS + Radix UI
- Docker + Nginx (optional für Deployment)

## Voraussetzungen

- Node.js 20+
- npm
- MySQL 8+ oder MariaDB

Optional:
- Docker + Docker Compose

## Projekt lokal starten

1. Abhängigkeiten installieren:

```bash
npm install
```

2. Umgebungsvariablen setzen:

Lege eine `.env` im Projektroot an (siehe Beispiel unten).

3. Prisma Client generieren:

```bash
npm run prisma:generate
```

4. Datenbank initialisieren:

Empfohlen mit Prisma:

```bash
npx prisma db push
```

Wenn ihr SQL-Skripte nutzt, führt die Dateien aus `scripts/` in der richtigen Reihenfolge aus.

5. Entwicklungsserver starten:

```bash
npm run dev
```

App läuft dann standardmäßig auf `http://localhost:3000`.

## Wichtige Skripte

- `npm run dev` – Development
- `npm run build` – Production Build
- `npm run start` – Production Start
- `npm run prisma:generate` – Prisma Client generieren

## Beispiel `.env`

```env
DATABASE_URL="mysql://user:password@localhost:3306/astroforms"
NODE_ENV="development"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-random-secret"
AUTH_TRUST_HOST="true"

# OAuth Provider (optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""

# Mail (optional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="AstroForms <noreply@example.com>"
```

## Kommentare: Threads + Reactions

Für Kommentar-Antworten und Emoji-Reactions liegt eine Migration unter:

- `scripts/021_comment_threads_and_reactions.sql`

Hinweis: Das Script ist für MySQL/MariaDB geschrieben und benötigt DB-Rechte wie `ALTER`, `CREATE`, `INDEX`, `REFERENCES`.

## Docker (optional)

Das Repository enthält ein `docker-compose.yml` mit:

- `mysql`
- `web` (Next.js App)
- `nginx`

Start:

```bash
docker compose up -d --build
```

## Contributing

Contributions sind willkommen.

1. Fork erstellen
2. Branch anlegen (`feature/...`, `fix/...`)
3. Änderungen committen
4. Pull Request öffnen

Bitte möglichst:

- TypeScript-Fehler vermeiden (`npx tsc --noEmit`)
- kleine, nachvollziehbare PRs erstellen
- bei DB-Änderungen Migration/Skript mitliefern

## Sicherheit

- Keine Secrets in Commits
- Falls jemals Secrets committed wurden: sofort rotieren
- Produktionszugänge nur über sichere Umgebungsvariablen verwalten
- Änderungen immer zuerst lokal/staging testen, bevor sie in Produktion ausgerollt werden
## Lizenz

Dieses Projekt steht unter der **GNU General Public License v3.0 (GPL-3.0)**.

Siehe `LICENSE`.
