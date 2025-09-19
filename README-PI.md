# OctoPrintFarmProgramHU - Raspberry Pi Installatiehandleiding

Deze handleiding beschrijft hoe je het volledige OctoPrintFarmProgramHU project installeert en draait op een nieuwe Raspberry Pi (Pi 4 aanbevolen, met minimaal 2GB RAM).

---

## Inhoud
- Benodigdheden
- Systeemvereisten
- Installatie stappen
  - 1. Systeem voorbereiden
  - 2. Project klonen
  - 3. .env configuratie
  - 4. Backend installeren & starten
  - 5. Frontend installeren & builden
  - 6. Database setup
  - 7. Docker (optioneel)
- Services & poorten
- Troubleshooting
- Tips voor performance

---

## Benodigdheden
- Raspberry Pi 4 (of nieuwer) met Raspberry Pi OS (64-bit aanbevolen)
- Internetverbinding
- Toegang tot terminal (SSH of lokaal)
- GitHub account voor OAuth
- Gmail of SMTP account voor email (voor verificatie)

## Systeemvereisten
- Node.js 18.x (gebruik `nvm` of `apt`)
- npm (meestal meegeleverd met Node.js)
- Python 3 (voor OctoPrint integratie)
- Docker & docker-compose (optioneel, aanbevolen voor productie)

---

## 1. Systeem voorbereiden
```sh
sudo apt update && sudo apt upgrade -y
sudo apt install git nodejs npm python3 python3-pip sqlite3 -y
# (optioneel) Docker installeren:
curl -sSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install docker-compose -y
```
Herstart je Pi na Docker installatie:
```sh
sudo reboot
```

## 2. Project klonen
```sh
git clone https://github.com/RickMageddon/OctoPrintFarmProgramHU.git
cd OctoPrintFarmProgramHU
```

## 3. .env configuratie
- Kopieer `.env.example` naar `.env` in de backend map:
```sh
cd backend
cp .env.example .env
```
- Vul alle variabelen in:
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (zie GitHub OAuth app)
  - `EMAIL_USER`, `EMAIL_PASS` (Gmail of SMTP)
  - `FRONTEND_URL`, `BACKEND_URL` (meestal `http://localhost:3000` en `http://localhost:3001`)

## 4. Backend installeren & starten
```sh
cd backend
npm install
npm run setup-db   # Initialiseer database
npm start          # Start backend op poort 3001
```

## 5. Frontend installeren & builden
```sh
cd ../frontend
npm install
npm run build      # Voor productie (build in /build)
# OF voor development:
npm start          # Start op poort 3000
```

## 6. Database setup
- De backend maakt automatisch een SQLite database aan (`backend/printfarm.db`).
- Voor een schone start kun je `printfarm.db` verwijderen en opnieuw `npm run setup-db` uitvoeren.

## 7. Docker (optioneel, aanbevolen)
- Gebruik Docker Compose om alles in containers te draaien:
```sh
docker-compose up --build
```
- Dit start backend, frontend en eventuele services automatisch.

---

## Services & Poorten
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- OctoPrint API: (extern, configureer in backend/services/octoprintService.js)

---

## Troubleshooting
- **Frontend start niet?**
  - Controleer Node versie (`node -v`), moet 18.x zijn.
  - Check foutmeldingen in terminal, los syntaxfouten op.
- **Backend errors?**
  - Controleer `.env` variabelen en database rechten.
  - Check of poort 3001 vrij is.
- **Email werkt niet?**
  - Gebruik een app-wachtwoord voor Gmail of een SMTP server zonder 2FA.
- **GitHub OAuth werkt niet?**
  - Controleer redirect URI in GitHub Developer settings.
- **OctoPrint integratie werkt niet?**
  - Vul juiste OctoPrint API key en URL in backend/services/octoprintService.js

---

## Tips voor performance op de Pi
- Gebruik een Pi 4 met actieve koeling.
- Draai alleen noodzakelijke services.
- Gebruik Docker voor eenvoudig beheer.
- Zet `NODE_ENV=production` in je `.env` voor betere performance.

---

## Credits
- Project: Rick van der Voort (Turing Lab)
- Voor vragen/support: turinglab@hu.nl

---

Succes met Printmeister op je Raspberry Pi!