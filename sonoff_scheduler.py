import serial
import time
from datetime import datetime, timedelta

# Tasmota configuratie via FT232
SERIAL_PORT = '/dev/ttyUSB0'  # FT232 adapter poort
BAUDRATE = 115200              # Tasmota standaard baud rate

# Tasmota commando's voor 4CH relais
RELAY_ON = ['Power1 ON', 'Power2 ON', 'Power3 ON', 'Power4 ON']   # R1, R2, R3, R4 aan
RELAY_OFF = ['Power1 OFF', 'Power2 OFF', 'Power3 OFF', 'Power4 OFF']  # R1, R2, R3, R4 uit

def send_command(cmd_text):
   """
   Stuur Tasmota commando via serial
   cmd_text: bijvoorbeeld 'Power1 ON'
   """
   try:
      with serial.Serial(SERIAL_PORT, BAUDRATE, timeout=1) as ser:
         # Tasmota verwacht commando's met carriage return + newline
         cmd_bytes = (cmd_text + '\r\n').encode('utf-8')
         ser.write(cmd_bytes)
         time.sleep(0.2)  # Kleine delay tussen commando's
         print(f"✅ Verzonden: {cmd_text}")
   except Exception as e:
      print(f"❌ Fout bij verzenden commando '{cmd_text}': {e}")

def all_on():
   """Zet alle relais aan"""
   print("🔌 Alle printers aanzetten...")
   for cmd in RELAY_ON:
      send_command(cmd)

def all_off():
   """Zet alle relais uit"""
   print("🔌 Alle printers uitzetten...")
   for cmd in RELAY_OFF:
      send_command(cmd)

def can_start_print(estimated_minutes):
   now = datetime.now()
   end_time = now + timedelta(minutes=estimated_minutes)
   shutdown_time = now.replace(hour=20, minute=0, second=0, microsecond=0)
   if end_time > shutdown_time:
      return False, (shutdown_time - now).seconds // 60
   return True, (shutdown_time - now).seconds // 60

def main_loop():
   while True:
      now = datetime.now()
      if now.hour == 8 and now.minute == 30:
         print("Printers aanzetten...")
         all_on()
         time.sleep(60)
      elif now.hour == 20 and now.minute == 0:
         print("Printers uitzetten...")
         all_off()
         time.sleep(60)
      time.sleep(10)

if __name__ == "__main__":
   main_loop()
