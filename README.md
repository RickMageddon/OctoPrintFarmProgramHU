# HU OctoPrint Farm

Een complete 3D print farm management systeem voor Hogeschool Utrecht, met 3 Prusa printers gecontroleerd via OctoPrint in Docker containers.

## 🚀 Features

- **3 OctoPrint Instances**: Elke Prusa printer heeft zijn eigen OctoPrint instance
- **GitHub OAuth**: Veilige authenticatie via GitHub
- **HU Email Verificatie**: Alleen @hu.nl en @student.hu.nl adressen toegestaan
- **Print Queue Management**: Intelligente wachtrij met prioriteiten
- **File Management**: Upload en beheer max 10 favoriete bestanden per gebruiker
- **Real-time Updates**: Live status updates via Socket.IO
- **Admin Panel**: Uitgebreide beheersfuncties voor administrators
- **Responsive Design**: Werkt op desktop, tablet en mobiel

## 🏗️ Architectuur

```
├── backend/           # Node.js Express API
├── frontend/          # React applicatie
├── docker/           # Docker configuraties
├── database/         # SQLite database
├── uploads/          # Geüploade bestanden
└── docker-compose.yml
```

## 📋 Vereisten

- **Hardware**:
  - Raspberry Pi 4 (4GB+ RAM aanbevolen)
  - 3x Prusa 3D printers
  - USB kabels voor printer verbindingen
  - SD kaart (32GB+)

- **Software**:
  - Docker & Docker Compose
  - Git

## 🚀 Installatie

### 1. Repository Clonen

```bash
git clone <repository-url>
cd OctoPrintFarmProgramHU
```

### 2. Environment Variabelen

Kopieer en bewerk het environment bestand:

```bash
cp .env.example .env
```

Bewerk `.env` met jouw configuratie:

```env
# GitHub OAuth (maak aan op https://github.com/settings/applications/new)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_ORG_NAME=your_organization_name

# Session Secret (genereer een sterke random string)
SESSION_SECRET=your_super_secret_session_key

# Email Configuration
EMAIL_USER=your_smtp_email@gmail.com
EMAIL_PASS=your_smtp_app_password

# OctoPrint API Keys (krijg je na eerste setup)
OCTOPRINT1_API_KEY=your_octoprint1_api_key
OCTOPRINT2_API_KEY=your_octoprint2_api_key
OCTOPRINT3_API_KEY=your_octoprint3_api_key
```

### 3. USB Devices Configureren

Controleer welke USB poorten je printers gebruiken:

```bash
ls -la /dev/ttyUSB*
```

Update de device mappings in `docker-compose.yml` indien nodig.

### 4. GitHub OAuth Setup

1. Ga naar [GitHub Developer Settings](https://github.com/settings/applications/new)
2. Maak een nieuwe OAuth App:
   - **Application name**: HU OctoPrint Farm
   - **Homepage URL**: `http://your-pi-ip:3000`
   - **Authorization callback URL**: `http://your-pi-ip:3001/auth/github/callback`
3. Kopieer Client ID en Client Secret naar `.env`

### 5. Email Setup (Gmail)

1. Ga naar je [Google Account instellingen](https://myaccount.google.com/)
2. Zet 2-factor authenticatie aan
3. Genereer een App Password voor "Mail"
4. Gebruik je email en app password in `.env`

### 6. Docker Containers Starten

```bash
# Start alle services
docker-compose up -d

# Bekijk logs
docker-compose logs -f

# Herstart een service
docker-compose restart backend
```

## 🔧 Configuratie

### OctoPrint Setup

Na het starten van de containers:

1. Ga naar elke OctoPrint instance:
   - Printer 1: `http://your-pi-ip:5001`
   - Printer 2: `http://your-pi-ip:5002`
   - Printer 3: `http://your-pi-ip:5003`

2. Voltooi de OctoPrint setup wizard voor elke printer
3. Ga naar Settings → API en genereer API keys
4. Voeg de API keys toe aan `.env`
5. Herstart de backend: `docker-compose restart backend`

### Printer Verbindingen

Voor elke OctoPrint instance:

1. Ga naar Settings → Serial Connection
2. Configureer de juiste baudrate (meestal 115200 voor Prusa)
3. Test de verbinding met je printer

## 🎯 Gebruik

### Voor Gebruikers

1. **Inloggen**: Klik op "Inloggen met GitHub"
2. **Email Verificatie**: Voer je @hu.nl of @student.hu.nl email in
3. **Bestanden Uploaden**: Upload .gcode bestanden (max 10 favorieten)
4. **Print Queue**: Voeg bestanden toe aan de wachtrij
5. **Status Monitoring**: Bekijk real-time printer status en voortgang

### Voor Administrators

Administrators (leden van de GitHub organisatie) hebben extra rechten:

- Gebruikersbeheer
- Print queue prioriteiten aanpassen
- Systeemstatistieken bekijken
- Bestanden verwijderen van printers

## 🔒 Beveiliging

- **GitHub OAuth**: Alleen geautoriseerde GitHub accounts
- **HU Email Verificatie**: Dubbele verificatie met HU email
- **Admin Rechten**: Gebaseerd op GitHub organisatie lidmaatschap
- **Rate Limiting**: API bescherming tegen misbruik
- **Session Management**: Veilige session handling

## 📊 Monitoring

### Logs Bekijken

```bash
# Alle logs
docker-compose logs -f

# Specifieke service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f octoprint1
```

### Database Toegang

```bash
# SQLite database openen
docker-compose exec backend sqlite3 /app/database/farm.db

# Backup maken
docker-compose exec backend sqlite3 /app/database/farm.db .dump > backup.sql
```

### System Resources

```bash
# Container status
docker-compose ps

# Resource gebruik
docker stats

# Disk usage
docker system df
```

## 🛠️ Troubleshooting

### Veelvoorkomende Problemen

**1. OctoPrint kan geen verbinding maken met printer**
```bash
# Controleer USB devices
ls -la /dev/ttyUSB*

# Controleer container logs
docker-compose logs octoprint1
```

**2. Email verificatie werkt niet**
```bash
# Controleer email configuratie
docker-compose exec backend node -e "
const EmailService = require('./services/emailService');
const service = new EmailService();
service.testConnection().then(console.log);
"
```

**3. GitHub OAuth redirect problemen**
- Controleer of callback URL klopt in GitHub settings
- Zorg dat FRONTEND_URL en BACKEND_URL correct zijn

**4. Database errors**
```bash
# Database resetten (VOORZICHTIG!)
docker-compose down
sudo rm -rf database/farm.db
docker-compose up -d
```

### Debug Mode

Voor uitgebreide logging:

```bash
# Backend debug
docker-compose exec backend npm run dev

# Database queries loggen
NODE_ENV=development docker-compose up backend
```

## 🔄 Updates

```bash
# Pull nieuwe code
git pull origin main

# Rebuild containers
docker-compose build

# Restart met nieuwe versie
docker-compose up -d
```

## 🤝 Bijdragen

1. Fork het project
2. Maak een feature branch (`git checkout -b feature/nieuwe-functie`)
3. Commit je wijzigingen (`git commit -m 'Voeg nieuwe functie toe'`)
4. Push naar de branch (`git push origin feature/nieuwe-functie`)
5. Open een Pull Request

## 📝 License

Dit project is gelicenseerd onder de MIT License.

## 🆘 Support

Voor problemen of vragen:

1. Check de troubleshooting sectie
2. Bekijk de logs voor error messages
3. Open een issue op GitHub
4. Neem contact op met de ICT afdeling van HU

## 🙏 Credits

Ontwikkeld voor Hogeschool Utrecht door [Je naam]

Gebruikt:
- [OctoPrint](https://octoprint.org/) voor 3D printer control
- [React](https://reactjs.org/) voor de frontend
- [Node.js](https://nodejs.org/) voor de backend
- [Material-UI](https://mui.com/) voor UI components
