import serial
import time
from datetime import datetime, timedelta

# Pas aan indien je een andere poort gebruikt
SERIAL_PORT = '/dev/serial0'
BAUDRATE = 9600

# Sonoff 4CH Pro R3 commando's (voorbeeld, check je handleiding voor exacte bytes)
RELAY_ON = ['A00101A2', 'A00201A3', 'A00301A4']   # R1, R2, R3 aan
RELAY_OFF = ['A00100A1', 'A00200A2', 'A00300A3']  # R1, R2, R3 uit

def send_command(cmd_hex):
   # cmd_hex is een hex-string, bijvoorbeeld 'A00101A2'
   cmd_bytes = bytes.fromhex(cmd_hex)
   with serial.Serial(SERIAL_PORT, BAUDRATE, timeout=1) as ser:
      ser.write(cmd_bytes)
      time.sleep(0.1)

def all_on():
   for cmd in RELAY_ON:
      send_command(cmd)

def all_off():
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
