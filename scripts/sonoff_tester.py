#!/usr/bin/env python3
"""
Sonoff UART Tester - Test Script
Schakelt elke 5 seconden alle 4 relais aan en uit via UART communicatie.

Aansluitschema (volgens README-PI):
Sonoff Pin | Pi Pin (GPIO) | Kleur   | Pi Pin Nummer
3.3V       | 3.3V         | Rood    | 1
RX         | TXD (GPIO14) | Oranje  | 8  
TX         | RXD (GPIO15) | Geel    | 10
GND        | GND          | Zwart   | 6

Gebruik:
sudo python3 sonoff_tester.py

Druk Ctrl+C om te stoppen.
"""

import time
import sys
from datetime import datetime

# UART configuratie
UART_PORT = "/dev/ttyS0"  # Seriële poort op Pi
BAUD_RATE = 115200
TIMEOUT = 1

# Sonoff commando's (eWeLink/Tasmota protocol)
RELAY_COMMANDS = {
    "relay_1_on": b"AT+DIPS=1,1\r\n",
    "relay_1_off": b"AT+DIPS=1,0\r\n",
    "relay_2_on": b"AT+DIPS=2,1\r\n", 
    "relay_2_off": b"AT+DIPS=2,0\r\n",
    "relay_3_on": b"AT+DIPS=3,1\r\n",
    "relay_3_off": b"AT+DIPS=3,0\r\n",
    "relay_4_on": b"AT+DIPS=4,1\r\n",
    "relay_4_off": b"AT+DIPS=4,0\r\n",
    "status": b"AT+DIPS?\r\n"
}

# Serial library importeren
try:
    import serial
except ImportError:
    print("❌ pyserial module niet gevonden!")
    print("Installeer met: pip3 install pyserial")
    sys.exit(1)

def log_message(message):
    """Print bericht met timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def setup_uart():
    """Initialiseer UART verbinding"""
    try:
        ser = serial.Serial(
            port=UART_PORT,
            baudrate=BAUD_RATE,
            timeout=TIMEOUT,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS
        )
        
        if ser.is_open:
            log_message(f"✅ UART verbinding geopend op {UART_PORT}")
            return ser
        else:
            log_message(f"❌ Kan UART niet openen op {UART_PORT}")
            return None
            
    except serial.SerialException as e:
        log_message(f"❌ UART setup fout: {e}")
        log_message("💡 Controleer of seriële poort ingeschakeld is:")
        log_message("   sudo raspi-config → Interface Options → Serial")
        log_message("   → login shell NO, serial port YES")
        return None
    except Exception as e:
        log_message(f"❌ Onverwachte fout: {e}")
        return None

def send_command(ser, command):
    """Verstuur commando naar Sonoff en lees response"""
    try:
        if not ser or not ser.is_open:
            log_message("❌ UART verbinding niet beschikbaar")
            return None
        
        # Verstuur commando
        ser.write(command)
        ser.flush()
        
        # Wacht op response
        time.sleep(0.1)
        response = ser.read_all()
        
        if response:
            return response.decode('utf-8', errors='ignore').strip()
        else:
            return "No response"
            
    except Exception as e:
        log_message(f"❌ Commando fout: {e}")
        return None

def switch_relay(ser, relay_number, state):
    """
    Schakel een relay aan of uit via UART
    
    Args:
        ser: Serial object
        relay_number (int): Relay nummer (1-4)
        state (str): 'on' of 'off'
    """
    try:
        command_key = f"relay_{relay_number}_{state}"
        
        if command_key not in RELAY_COMMANDS:
            log_message(f"❌ Ongeldig commando: {command_key}")
            return False
        
        command = RELAY_COMMANDS[command_key]
        response = send_command(ser, command)
        
        if response and "OK" in response:
            log_message(f"✅ Relay {relay_number} {state.upper()} - Success")
            return True
        else:
            log_message(f"❌ Relay {relay_number} {state.upper()} - Response: {response}")
            return False
            
    except Exception as e:
        log_message(f"❌ Relay {relay_number} fout: {e}")
        return False

def switch_all_relays(ser, state):
    """Schakel alle relays tegelijk aan of uit"""
    log_message(f"🔄 Alle relays {state.upper()}")
    
    success_count = 0
    for relay_num in range(1, 5):
        if switch_relay(ser, relay_num, state):
            success_count += 1
        time.sleep(0.2)  # Kleine delay tussen commando's
    
    log_message(f"✅ {success_count}/4 relays succesvol geschakeld")
    return success_count == 4

def test_uart_connection(ser):
    """Test UART verbinding met status commando"""
    try:
        log_message("🔧 Test UART verbinding...")
        response = send_command(ser, RELAY_COMMANDS["status"])
        
        if response:
            log_message(f"📡 Sonoff response: {response}")
            return True
        else:
            log_message("❌ Geen response van Sonoff")
            return False
            
    except Exception as e:
        log_message(f"❌ Verbindingstest fout: {e}")
        return False

def test_individual_relays(ser):
    """Test elke relay individueel"""
    log_message("🔧 Individuele relay test...")
    
    for relay_num in range(1, 5):
        log_message(f"Testing Relay {relay_num}...")
        switch_relay(ser, relay_num, "on")
        time.sleep(1)
        switch_relay(ser, relay_num, "off")
        time.sleep(0.5)
    
    log_message("✅ Individuele test voltooid")

def cleanup_uart(ser):
    """Sluit UART verbinding en zet alle relays uit"""
    try:
        log_message("🧹 UART cleanup...")
        
        # Alle relays UIT
        switch_all_relays(ser, "off")
        time.sleep(0.5)
        
        # Sluit verbinding
        if ser and ser.is_open:
            ser.close()
            log_message("✅ UART verbinding gesloten")
        
    except Exception as e:
        log_message(f"❌ Cleanup fout: {e}")

def main():
    """Hoofdloop voor relay testing"""
    log_message("🚀 Sonoff UART Tester gestart")
    log_message("📌 UART Configuratie:")
    log_message(f"   Poort: {UART_PORT}")
    log_message(f"   Baud: {BAUD_RATE}")
    log_message("📌 Aansluitschema:")
    log_message("   Sonoff 3.3V → Pi Pin 1 (3.3V)")
    log_message("   Sonoff RX   → Pi Pin 8 (TXD/GPIO14)")
    log_message("   Sonoff TX   → Pi Pin 10 (RXD/GPIO15)")
    log_message("   Sonoff GND  → Pi Pin 6 (GND)")
    log_message("⏱️  Cyclus: 5 seconden AAN -> 5 seconden UIT")
    log_message("🛑 Druk Ctrl+C om te stoppen")
    print("-" * 60)
    
    # UART setup
    ser = setup_uart()
    if not ser:
        log_message("❌ UART setup mislukt. Programma gestopt.")
        return
    
    try:
        # Test verbinding
        if not test_uart_connection(ser):
            log_message("⚠️  Geen response van Sonoff, maar doorgaan met test...")
        
        # Individuele test
        test_individual_relays(ser)
        time.sleep(2)
        
        cycle_count = 0
        
        while True:
            cycle_count += 1
            log_message(f"🔄 Cyclus #{cycle_count}")
            
            # Alle relays AAN
            switch_all_relays(ser, "on")
            log_message("⏳ Wachten 5 seconden...")
            time.sleep(5)
            
            # Alle relays UIT  
            switch_all_relays(ser, "off")
            log_message("⏳ Wachten 5 seconden...")
            time.sleep(5)
            
            print("-" * 40)
            
    except KeyboardInterrupt:
        log_message("🛑 Stop signaal ontvangen")
    except Exception as e:
        log_message(f"❌ Onverwachte fout: {e}")
    finally:
        cleanup_uart(ser)
        log_message("✅ Sonoff UART Tester gestopt")

if __name__ == "__main__":
    main()