#!/bin/bash
# Installatie-script voor OctoPrint Farm op een nieuwe mini-pc of Raspberry Pi
# Voer uit als root of met sudo: bash install.sh

set -e

# 1. Systeem updaten
sudo apt-get update && sudo apt-get upgrade -y

# 2. Installeer Docker & docker-compose indien nodig
if ! command -v docker &> /dev/null; then
    echo "Docker wordt geïnstalleerd..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "Docker geïnstalleerd. Log opnieuw in om de docker groep te activeren."
fi

if ! command -v docker-compose &> /dev/null; then
    echo "docker-compose wordt geïnstalleerd..."
    sudo apt-get install -y docker-compose
fi

echo "Docker en docker-compose zijn geïnstalleerd."

# 3. Symlinks voor printers aanmaken
if [ -d /dev/serial/by-id ]; then
    echo "Aangesloten printers gevonden. Symlinks worden aangemaakt..."
    bash ./scripts/create-octoprint-symlinks.sh
else
    echo "Waarschuwing: /dev/serial/by-id bestaat niet. Sluit printers aan en probeer opnieuw."
fi

# 4. Docker containers opstarten
sudo docker-compose up -d --build

echo "\nInstallatie voltooid!"
echo "Controleer de OctoPrint webinterfaces en stel de juiste seriële poorten in (bijv. /dev/octoprint_printer1) in elke OctoPrint-instantie."
echo "Vergeet niet de OctoPrint API keys in te stellen in de .env van de backend."
