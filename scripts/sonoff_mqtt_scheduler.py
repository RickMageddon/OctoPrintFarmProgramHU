#!/usr/bin/env python3
"""
Sonoff MQTT Scheduler - Test Script
Voor Sonoff met Tasmota firmware via MQTT

Gebruik:
python3 sonoff_mqtt_scheduler.py

Druk Ctrl+C om te stoppen.
"""

import time
import json
from datetime import datetime

# MQTT configuratie
MQTT_BROKER = "192.168.1.100"  # Vervang door jouw MQTT broker IP
MQTT_PORT = 1883
MQTT_TOPIC_PREFIX = "cmnd/sonoff/POWER"  # Vervang 'sonoff' door jouw device naam

def log_message(message):
    """Print bericht met timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def switch_relay_mqtt(relay_number, state):
    """Schakel relay via MQTT (Tasmota)"""
    try:
        import paho.mqtt.client as mqtt
        
        client = mqtt.Client()
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        
        topic = f"{MQTT_TOPIC_PREFIX}{relay_number}"
        payload = "ON" if state == "on" else "OFF"
        
        client.publish(topic, payload)
        client.disconnect()
        
        log_message(f"📡 MQTT: Relay {relay_number} -> {payload}")
        
    except ImportError:
        log_message("❌ paho-mqtt niet geïnstalleerd: pip3 install paho-mqtt")
    except Exception as e:
        log_message(f"❌ MQTT Error: {e}")

def main_mqtt():
    """MQTT versie van de scheduler"""
    log_message("🚀 Sonoff MQTT Scheduler gestart")
    log_message(f"📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    log_message("⏱️  Cyclus: 5 seconden AAN -> 5 seconden UIT")
    log_message("🛑 Druk Ctrl+C om te stoppen")
    print("-" * 60)
    
    try:
        cycle_count = 0
        
        while True:
            cycle_count += 1
            log_message(f"🔄 Cyclus #{cycle_count}")
            
            # Alle relays AAN (1-4)
            for relay in range(1, 5):
                switch_relay_mqtt(relay, "on")
                time.sleep(0.2)
            
            log_message("⏳ Wachten 5 seconden...")
            time.sleep(5)
            
            # Alle relays UIT
            for relay in range(1, 5):
                switch_relay_mqtt(relay, "off")
                time.sleep(0.2)
                
            log_message("⏳ Wachten 5 seconden...")
            time.sleep(5)
            print("-" * 40)
            
    except KeyboardInterrupt:
        log_message("🛑 Stop signaal ontvangen")
        log_message("🔄 Alle relays uitschakelen...")
        for relay in range(1, 5):
            switch_relay_mqtt(relay, "off")
        log_message("✅ MQTT Scheduler gestopt")

if __name__ == "__main__":
    print("Welke versie wil je gebruiken?")
    print("1. HTTP/REST API versie")
    print("2. MQTT versie (Tasmota)")
    
    choice = input("Keuze (1 of 2): ").strip()
    
    if choice == "2":
        main_mqtt()
    else:
        # Import de main functie van de HTTP versie
        from sonoff_scheduler import main
        main()