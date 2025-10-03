const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SonoffService {
    constructor() {
        // Sonoff 4CH Pro R3 relay commands (hex format)
        this.relayCommands = {
            1: { on: 'A00101A2', off: 'A00100A1' },  // Relay 1 (Printer 1)
            2: { on: 'A00201A3', off: 'A00200A2' },  // Relay 2 (Printer 2)
            3: { on: 'A00301A4', off: 'A00300A3' },  // Relay 3 (Printer 3)
            4: { on: 'A00401A5', off: 'A00400A4' }   // Relay 4 (Printer 4 / spare)
        };
        
        // Serial port configuration
        this.serialPort = process.env.SONOFF_SERIAL_PORT || '/dev/serial0';
        this.baudRate = process.env.SONOFF_BAUDRATE || '9600';
        
        // Track relay states in memory (should sync with actual hardware on startup)
        this.relayStates = {
            1: false,
            2: false,
            3: false,
            4: false
        };
        
        console.log('🔌 Sonoff Service initialized');
        console.log(`   Serial port: ${this.serialPort}`);
        console.log(`   Baud rate: ${this.baudRate}`);
    }

    /**
     * Send hex command to Sonoff via serial port
     * @param {string} hexCommand - Hex string like 'A00101A2'
     */
    async sendCommand(hexCommand) {
        try {
            // Use Python script to send command (more reliable than Node serial)
            const pythonCommand = `python3 -c "import serial; ser = serial.Serial('${this.serialPort}', ${this.baudRate}, timeout=1); ser.write(bytes.fromhex('${hexCommand}')); ser.close()"`;
            
            const { stdout, stderr } = await execPromise(pythonCommand);
            
            if (stderr) {
                console.warn('⚠️ Sonoff command stderr:', stderr);
            }
            
            console.log(`✅ Sent Sonoff command: ${hexCommand}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error sending Sonoff command:', error.message);
            throw new Error(`Failed to send command to Sonoff: ${error.message}`);
        }
    }

    /**
     * Turn relay ON
     * @param {number} relayId - Relay number (1-4)
     */
    async turnOn(relayId) {
        if (!this.relayCommands[relayId]) {
            throw new Error(`Invalid relay ID: ${relayId}. Must be 1-4.`);
        }

        const command = this.relayCommands[relayId].on;
        await this.sendCommand(command);
        this.relayStates[relayId] = true;
        
        console.log(`🔌 Relay ${relayId} turned ON`);
        return { success: true, relayId, state: 'on' };
    }

    /**
     * Turn relay OFF
     * @param {number} relayId - Relay number (1-4)
     */
    async turnOff(relayId) {
        if (!this.relayCommands[relayId]) {
            throw new Error(`Invalid relay ID: ${relayId}. Must be 1-4.`);
        }

        const command = this.relayCommands[relayId].off;
        await this.sendCommand(command);
        this.relayStates[relayId] = false;
        
        console.log(`🔌 Relay ${relayId} turned OFF`);
        return { success: true, relayId, state: 'off' };
    }

    /**
     * Toggle relay state
     * @param {number} relayId - Relay number (1-4)
     */
    async toggle(relayId) {
        const currentState = this.relayStates[relayId];
        if (currentState) {
            return await this.turnOff(relayId);
        } else {
            return await this.turnOn(relayId);
        }
    }

    /**
     * Turn all relays ON
     */
    async turnAllOn() {
        console.log('🔌 Turning all relays ON...');
        const results = [];
        
        for (let i = 1; i <= 4; i++) {
            try {
                const result = await this.turnOn(i);
                results.push(result);
                // Small delay between commands
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`❌ Failed to turn on relay ${i}:`, error.message);
                results.push({ success: false, relayId: i, error: error.message });
            }
        }
        
        return { success: true, results };
    }

    /**
     * Turn all relays OFF
     */
    async turnAllOff() {
        console.log('🔌 Turning all relays OFF...');
        const results = [];
        
        for (let i = 1; i <= 4; i++) {
            try {
                const result = await this.turnOff(i);
                results.push(result);
                // Small delay between commands
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`❌ Failed to turn off relay ${i}:`, error.message);
                results.push({ success: false, relayId: i, error: error.message });
            }
        }
        
        return { success: true, results };
    }

    /**
     * Get current relay states
     */
    getStates() {
        return { ...this.relayStates };
    }

    /**
     * Get relay state for specific relay
     * @param {number} relayId - Relay number (1-4)
     */
    getState(relayId) {
        if (!this.relayCommands[relayId]) {
            throw new Error(`Invalid relay ID: ${relayId}. Must be 1-4.`);
        }
        return this.relayStates[relayId];
    }

    /**
     * Map printer ID to relay ID (1:1 mapping)
     * @param {number} printerId - Printer ID
     */
    getPrinterRelay(printerId) {
        // Direct mapping: Printer 1 -> Relay 1, etc.
        if (printerId < 1 || printerId > 4) {
            throw new Error(`Invalid printer ID: ${printerId}. Must be 1-4.`);
        }
        return printerId;
    }

    /**
     * Control printer power
     * @param {number} printerId - Printer ID
     * @param {string} action - 'on' or 'off'
     */
    async controlPrinter(printerId, action) {
        const relayId = this.getPrinterRelay(printerId);
        
        if (action === 'on') {
            return await this.turnOn(relayId);
        } else if (action === 'off') {
            return await this.turnOff(relayId);
        } else {
            throw new Error(`Invalid action: ${action}. Must be 'on' or 'off'.`);
        }
    }
}

module.exports = SonoffService;
