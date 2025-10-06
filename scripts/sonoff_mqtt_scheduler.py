#!/usr/bin/env python3
"""
Sonoff Serial Scheduler - Test Script
Voor Sonoff met Tasmota firmware via Serial (FT232)

Gebruik:
python3 sonoff_mqtt_scheduler.py

Druk Ctrl+C om te stoppen.
"""

import time
import serial
from datetime import datetime

# Serial configuratie voor FT232 met Tasmota
SERIAL_PORT = '/dev/ttyUSB0'  # FT232 adapter poort
BAUDRATE = 115200              # Tasmota standaard baud rate

def log_message(message):
    """Print bericht met timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def send_tasmota_command(command):
    """
    Stuur Tasmota commando via serial
    command: bijvoorbeeld 'Power1 ON'
    """
    try:
        with serial.Serial(SERIAL_PORT, BAUDRATE, timeout=1) as ser:
            # Tasmota verwacht commando's met carriage return + newline
            cmd_bytes = (command + '\r\n').encode('utf-8')
            ser.write(cmd_bytes)
            time.sleep(0.2)  # Kleine delay tussen commando's
            log_message(f"✅ Verzonden: {command}")
            return True
    except Exception as e:
        log_message(f"❌ Fout bij verzenden commando '{command}': {e}")
        return False

def switch_relay_serial(relay_number, state):
    """Schakel relay via Serial (Tasmota)"""
    command = f"Power{relay_number} {'ON' if state == 'on' else 'OFF'}"
    return send_tasmota_command(command)

def main_serial_test():
    """Serial test versie van de scheduler"""
    log_message("🚀 Sonoff Serial Scheduler gestart")
    log_message(f"� Serial Port: {SERIAL_PORT}")
    log_message(f"⚡ Baud Rate: {BAUDRATE}")
    log_message("⏱️  Cyclus: 5 seconden AAN -> 5 seconden UIT")
    log_message("🛑 Druk Ctrl+C om te stoppen")
    print("-" * 60)
    
    try:
        cycle_count = 0
        
        while True:
            cycle_count += 1
            log_message(f"🔄 Cyclus #{cycle_count}")
            
            # Alle relays AAN (1-4)
            log_message("🔌 Alle relays aanzetten...")
            for relay in range(1, 5):
                switch_relay_serial(relay, "on")
                time.sleep(0.3)
            
            log_message("⏳ Wachten 5 seconden...")
            time.sleep(5)
            
            # Alle relays UIT
            log_message("🔌 Alle relays uitzetten...")
            for relay in range(1, 5):
                switch_relay_serial(relay, "off")
                time.sleep(0.3)
                
            log_message("⏳ Wachten 5 seconden...")
            time.sleep(5)
            print("-" * 40)
            
    except KeyboardInterrupt:
        log_message("🛑 Stop signaal ontvangen")
        log_message("🔄 Alle relays uitschakelen...")
        for relay in range(1, 5):
            switch_relay_serial(relay, "off")
        log_message("✅ Serial Scheduler gestopt")

if __name__ == "__main__":
    print("=" * 60)
    print("  Sonoff Serial Scheduler - Tasmota via FT232")
    print("=" * 60)
    print()
    main_serial_test()