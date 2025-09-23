#!/usr/bin/env python3
"""
Sonoff GPIO Tester - Advanced Version
Gebruikt configuratie bestand voor GPIO pin mapping.

Gebruik:
sudo python3 sonoff_tester_advanced.py

Druk Ctrl+C om te stoppen.
"""

import time
import sys
import os
import configparser
from datetime import datetime

def log_message(message):
    """Print bericht met timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def load_config():
    """Laad configuratie uit gpio_config.ini"""
    config = configparser.ConfigParser()
    config_file = os.path.join(os.path.dirname(__file__), 'gpio_config.ini')
    
    if not os.path.exists(config_file):
        log_message(f"❌ Config file niet gevonden: {config_file}")
        return None
    
    config.read(config_file)
    
    try:
        gpio_pins = {
            1: config.getint('GPIO_PINS', 'relay_1'),
            2: config.getint('GPIO_PINS', 'relay_2'),
            3: config.getint('GPIO_PINS', 'relay_3'),
            4: config.getint('GPIO_PINS', 'relay_4')
        }
        
        timing = {
            'cycle_delay': config.getfloat('TIMING', 'cycle_delay'),
            'relay_delay': config.getfloat('TIMING', 'relay_delay'),
            'test_delay': config.getfloat('TIMING', 'test_delay')
        }
        
        settings = {
            'active_low': config.getboolean('SETTINGS', 'relay_active_low'),
            'cleanup': config.getboolean('SETTINGS', 'cleanup_on_exit')
        }
        
        log_message("✅ Configuratie geladen")
        return gpio_pins, timing, settings
        
    except Exception as e:
        log_message(f"❌ Config parse fout: {e}")
        return None

def main():
    """Hoofdfunctie met config support"""
    log_message("🚀 Sonoff GPIO Tester Advanced gestart")
    
    # Laad configuratie
    config_data = load_config()
    if not config_data:
        log_message("❌ Kan niet starten zonder geldige configuratie")
        return
    
    gpio_pins, timing, settings = config_data
    
    # GPIO library importeren
    try:
        import RPi.GPIO as GPIO
    except ImportError:
        log_message("❌ RPi.GPIO module niet gevonden!")
        log_message("Installeer met: sudo apt-get install python3-rpi.gpio")
        return
    
    # Controleer root toegang
    if os.geteuid() != 0:
        log_message("⚠️  Waarschuwing: Script draait niet als root")
        log_message("   Voor GPIO toegang: sudo python3 sonoff_tester_advanced.py")
    
    # GPIO setup
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        
        for relay_num, pin in gpio_pins.items():
            GPIO.setup(pin, GPIO.OUT)
            # Start met relays UIT
            initial_state = GPIO.HIGH if settings['active_low'] else GPIO.LOW
            GPIO.output(pin, initial_state)
            log_message(f"🔧 GPIO {pin} (Relay {relay_num}) geconfigureerd")
        
        log_message("✅ GPIO setup voltooid")
        
    except Exception as e:
        log_message(f"❌ GPIO setup fout: {e}")
        return
    
    def switch_relay(relay_number, state):
        """Schakel relay aan/uit met config settings"""
        try:
            pin = gpio_pins[relay_number]
            
            if settings['active_low']:
                # Active LOW: LOW = AAN, HIGH = UIT
                gpio_state = GPIO.LOW if state == "on" else GPIO.HIGH
            else:
                # Active HIGH: HIGH = AAN, LOW = UIT  
                gpio_state = GPIO.HIGH if state == "on" else GPIO.LOW
            
            GPIO.output(pin, gpio_state)
            log_message(f"✅ Relay {relay_number} (GPIO {pin}) {state.upper()}")
            
        except Exception as e:
            log_message(f"❌ Relay {relay_number} fout: {e}")
    
    def cleanup():
        """Cleanup GPIO"""
        if settings['cleanup']:
            log_message("🧹 GPIO cleanup...")
            for relay_num in range(1, 5):
                switch_relay(relay_num, "off")
            time.sleep(0.5)
            GPIO.cleanup()
            log_message("✅ GPIO cleanup voltooid")
    
    # Hoofdloop
    try:
        log_message("📌 GPIO Pin mapping:")
        for relay, pin in gpio_pins.items():
            log_message(f"   Relay {relay} -> GPIO {pin}")
        log_message(f"⏱️  Cyclus: {timing['cycle_delay']} seconden AAN -> {timing['cycle_delay']} seconden UIT")
        log_message("🛑 Druk Ctrl+C om te stoppen")
        print("-" * 60)
        
        # Test elke relay individueel
        log_message("🔧 Individuele relay test...")
        for relay_num in range(1, 5):
            switch_relay(relay_num, "on")
            time.sleep(timing['test_delay'])
            switch_relay(relay_num, "off")
            time.sleep(timing['relay_delay'])
        
        time.sleep(2)
        cycle_count = 0
        
        while True:
            cycle_count += 1
            log_message(f"🔄 Cyclus #{cycle_count}")
            
            # Alle relays AAN
            log_message("🔄 Alle relays AAN")
            for relay_num in range(1, 5):
                switch_relay(relay_num, "on")
                time.sleep(timing['relay_delay'])
            
            log_message(f"⏳ Wachten {timing['cycle_delay']} seconden...")
            time.sleep(timing['cycle_delay'])
            
            # Alle relays UIT
            log_message("🔄 Alle relays UIT")  
            for relay_num in range(1, 5):
                switch_relay(relay_num, "off")
                time.sleep(timing['relay_delay'])
                
            log_message(f"⏳ Wachten {timing['cycle_delay']} seconden...")
            time.sleep(timing['cycle_delay'])
            print("-" * 40)
            
    except KeyboardInterrupt:
        log_message("🛑 Stop signaal ontvangen")
    except Exception as e:
        log_message(f"❌ Onverwachte fout: {e}")
    finally:
        cleanup()
        log_message("✅ Sonoff GPIO Tester gestopt")

if __name__ == "__main__":
    main()