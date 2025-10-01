#!/bin/bash
# Maak unieke symlinks aan voor elke 3D printer op basis van USB-ID
# Voer dit script uit op de Raspberry Pi of Linux-systeem waar de printers zijn aangesloten

# Zoek alle aangesloten seriële apparaten
ls -l /dev/serial/by-id/

# Maak symlinks aan voor elke printer (pas de USB-ID's aan naar jouw situatie)
# Voorbeeld:
# ln -s /dev/serial/by-id/usb-Prusa_Research_printer1-if00 /dev/octoprint_printer1
# ln -s /dev/serial/by-id/usb-Prusa_Research_printer2-if00 /dev/octoprint_printer2
# ln -s /dev/serial/by-id/usb-Prusa_Research_printer3-if00 /dev/octoprint_printer3

# Vervang de USB-ID's hieronder door de juiste uit ls -l /dev/serial/by-id/
ln -sf /dev/serial/by-id/usb-Prusa_Research_printer1-if00 /dev/octoprint_printer1
ln -sf /dev/serial/by-id/usb-Prusa_Research_printer2-if00 /dev/octoprint_printer2
ln -sf /dev/serial/by-id/usb-Prusa_Research_printer3-if00 /dev/octoprint_printer3

echo "Symlinks aangemaakt: /dev/octoprint_printer1, /dev/octoprint_printer2, /dev/octoprint_printer3"
