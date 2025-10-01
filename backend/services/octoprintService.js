const axios = require('axios');

class OctoPrintService {
    constructor(db = null) {
        this.db = db;
        this.printers = [
            {
                id: 1,
                name: 'Prusa Printer 1',
                url: process.env.OCTOPRINT1_URL || 'http://localhost:5001',
                apiKey: process.env.OCTOPRINT1_API_KEY
            },
            {
                id: 2,
                name: 'Prusa Printer 2', 
                url: process.env.OCTOPRINT2_URL || 'http://localhost:5002',
                apiKey: process.env.OCTOPRINT2_API_KEY
            },
            {
                id: 3,
                name: 'Prusa Printer 3',
                url: process.env.OCTOPRINT3_URL || 'http://localhost:5003',
                apiKey: process.env.OCTOPRINT3_API_KEY
            }
        ];
        
        // Debug logging for API keys
        console.log('OctoPrint Service initialized with:');
        this.printers.forEach(printer => {
            console.log(`  ${printer.name}: URL=${printer.url}, API Key=${printer.apiKey ? 'SET' : 'NOT SET'}`);
        });
    }

    setDatabase(db) {
        this.db = db;
    }

    // Reload API keys from environment variables
    reloadApiKeys() {
        console.log('Reloading OctoPrint API keys...');
        this.printers.forEach(printer => {
            const envVar = `OCTOPRINT${printer.id}_API_KEY`;
            const newApiKey = process.env[envVar];
            printer.apiKey = newApiKey;
            console.log(`  ${printer.name}: API Key ${newApiKey ? 'RELOADED' : 'NOT SET'}`);
        });
    }

    // Get printer configuration by ID
    getPrinter(printerId) {
        return this.printers.find(p => p.id === printerId);
    }

    // Create HTTP client for OctoPrint API
    createClient(printer) {
        if (!printer.apiKey) {
            // Try to reload API keys once before failing
            this.reloadApiKeys();
            
            if (!printer.apiKey) {
                throw new Error(`API key not configured for ${printer.name}`);
            }
        }

        return axios.create({
            baseURL: printer.url,
            headers: {
                'X-Api-Key': printer.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
    }

    // Get printer status
    async getPrinterStatus(printerId) {
        try {
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            
            // Get printer state
            const stateResponse = await client.get('/api/printer');
            const jobResponse = await client.get('/api/job');
            
            return {
                id: printerId,
                name: printer.name,
                state: stateResponse.data.state,
                job: jobResponse.data,
                temperature: stateResponse.data.temperature,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`Error getting status for printer ${printerId}:`, error.message);
            return {
                id: printerId,
                name: this.getPrinter(printerId)?.name || `Printer ${printerId}`,
                state: { text: 'Offline' },
                job: null,
                temperature: null,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Get all printer statuses
    async getAllPrinterStatus() {
        const statuses = await Promise.all(
            this.printers.map(printer => this.getPrinterStatus(printer.id))
        );
        return statuses;
    }

    // Upload file to printer
    async uploadFile(printerId, filePath, filename) {
        try {
            console.log(`📤 Uploading file to printer ${printerId}:`, { filePath, filename });
            
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            const fs = require('fs');
            const FormData = require('form-data');
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            // Check file extension
            const path = require('path');
            const ext = path.extname(filename).toLowerCase();
            if (!['.gcode', '.g', '.bgcode'].includes(ext)) {
                throw new Error(`Invalid file type: ${ext}. Only .gcode, .g, and .bgcode files are supported.`);
            }
            
            console.log(`📁 File validated: ${filename} (${ext})`);
            
            const form = new FormData();
            form.append('file', fs.createReadStream(filePath), filename);
            form.append('select', 'false');
            form.append('print', 'false');
            
            console.log(`🌐 Sending file to OctoPrint ${printer.name} at ${printer.apiUrl}`);
            
            const response = await client.post('/api/files/local', form, {
                headers: {
                    ...form.getHeaders(),
                    'X-Api-Key': printer.apiKey
                }
            });

            console.log(`✅ File uploaded successfully to ${printer.name}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Error uploading file to printer ${printerId}:`, {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    // Start print job
    async startPrint(printerId, filename) {
        try {
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            
            // Select and start print
            await client.post(`/api/files/local/${filename}`, {
                command: 'select',
                print: true
            });

            return { success: true, message: `Print started on ${printer.name}` };
        } catch (error) {
            console.error(`Error starting print on printer ${printerId}:`, error.message);
            throw error;
        }
    }

    // Cancel current print
    async cancelPrint(printerId) {
        try {
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            
            await client.post('/api/job', {
                command: 'cancel'
            });

            return { success: true, message: `Print cancelled on ${printer.name}` };
        } catch (error) {
            console.error(`Error cancelling print on printer ${printerId}:`, error.message);
            throw error;
        }
    }

    // Pause current print
    async pausePrint(printerId) {
        try {
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            
            await client.post('/api/job', {
                command: 'pause',
                action: 'pause'
            });

            return { success: true, message: `Print paused on ${printer.name}` };
        } catch (error) {
            console.error(`Error pausing print on printer ${printerId}:`, error.message);
            throw error;
        }
    }

    // Resume current print
    async resumePrint(printerId) {
        try {
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            
            await client.post('/api/job', {
                command: 'pause',
                action: 'resume'
            });

            return { success: true, message: `Print resumed on ${printer.name}` };
        } catch (error) {
            console.error(`Error resuming print on printer ${printerId}:`, error.message);
            throw error;
        }
    }

    // Get files on printer
    async getFiles(printerId) {
        try {
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            const response = await client.get('/api/files');
            
            return response.data;
        } catch (error) {
            console.error(`Error getting files from printer ${printerId}:`, error.message);
            throw error;
        }
    }

    // Delete file from printer
    async deleteFile(printerId, filename) {
        try {
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            await client.delete(`/api/files/local/${filename}`);
            
            return { success: true, message: `File ${filename} deleted from ${printer.name}` };
        } catch (error) {
            console.error(`Error deleting file from printer ${printerId}:`, error.message);
            throw error;
        }
    }

    // Update printer status in database
    async updateAllPrinterStatus() {
        try {
            if (!this.db) {
                console.warn('OctoPrintService.updateAllPrinterStatus called without db');
                return;
            }
            
            for (const printer of this.printers) {
                const status = await this.getPrinterStatus(printer.id);
                // Update printer_status table
                await this.db.run(
                    `UPDATE printer_status SET 
                     status = ?, 
                     last_update = CURRENT_TIMESTAMP 
                     WHERE id = ?`,
                    [status.state?.text || 'Unknown', printer.id]
                );

                // Mark print_queue as completed if print is done
                if (
                    status.state?.text === 'Operational' &&
                    (!status.job?.job?.file?.name || status.job?.state === 'Operational')
                ) {
                    // Zoek de print_queue entry die nog op 'printing' staat voor deze printer
                    const activeJob = await this.db.get(
                        `SELECT * FROM print_queue WHERE printer_id = ? AND status = 'printing' ORDER BY started_at DESC LIMIT 1`,
                        [printer.id]
                    );
                    if (activeJob) {
                        await this.db.run(
                            `UPDATE print_queue SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
                            [activeJob.id]
                        );
                        console.log(`✅ Printjob ${activeJob.id} op printer ${printer.id} gemarkeerd als completed.`);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating printer status in database:', error);
        }
    }

    // Process print queue
    async processQueue() {
        try {
            console.log('🔄 Processing print queue...');
            
            if (!this.db) {
                console.warn('❌ OctoPrintService.processQueue called without db');
                return;
            }
            
            // First, sync print queue status with actual printer status
            await this.syncQueueWithPrinterStatus();
            
            // Get next queued job
            const queuedJob = await this.db.get(
                `SELECT pq.*, u.username 
                 FROM print_queue pq 
                 JOIN users u ON pq.user_id = u.id 
                 WHERE pq.status = 'queued' 
                 ORDER BY pq.priority DESC, pq.created_at ASC 
                 LIMIT 1`
            );

            if (!queuedJob) {
                console.log('📭 No jobs in queue');
                return; // No jobs in queue
            }

            console.log(`📋 Found queued job: ${queuedJob.filename} for printer ${queuedJob.printer_id}`);

            // Check if printer is available
            const printerStatus = await this.getPrinterStatus(queuedJob.printer_id);
            console.log(`🖨️ Printer ${queuedJob.printer_id} status:`, printerStatus.state?.text);
            
            if (printerStatus.state?.text === 'Operational' && !printerStatus.job?.job?.file?.name) {
                // Printer is available, start the job
                console.log(`✅ Printer ${queuedJob.printer_id} is available, starting job`);
                try {
                    await this.uploadFile(
                        queuedJob.printer_id, 
                        queuedJob.file_path, 
                        queuedJob.filename
                    );
                    
                    await this.startPrint(queuedJob.printer_id, queuedJob.filename);
                    
                    // Update job status
                    await this.db.run(
                        `UPDATE print_queue SET 
                         status = 'printing', 
                         started_at = CURRENT_TIMESTAMP 
                         WHERE id = ?`,
                        [queuedJob.id]
                    );

                    console.log(`✅ Started print job ${queuedJob.id} on printer ${queuedJob.printer_id}`);
                } catch (error) {
                    // Mark job as failed
                    await this.db.run(
                        `UPDATE print_queue SET 
                         status = 'failed' 
                         WHERE id = ?`,
                        [queuedJob.id]
                    );
                    
                    console.error(`❌ Failed to start print job ${queuedJob.id}:`, error);
                }
            } else {
                console.log(`⏳ Printer ${queuedJob.printer_id} not available:`, {
                    state: printerStatus.state?.text,
                    hasActiveJob: !!printerStatus.job?.job?.file?.name
                });
            }
        } catch (error) {
            console.error('❌ Error processing queue:', error);
        }
    }

    // Sync print queue status with actual printer status
    async syncQueueWithPrinterStatus() {
        try {
            console.log('🔄 Syncing queue status with printer status...');
            
            // Get all jobs that are marked as "printing" in the database
            const printingJobs = await this.db.all(
                'SELECT * FROM print_queue WHERE status = "printing"'
            );

            for (const job of printingJobs) {
                if (job.printer_id) {
                    try {
                        const printerStatus = await this.getPrinterStatus(job.printer_id);
                        
                        if (printerStatus) {
                            const printerState = printerStatus.state?.text?.toLowerCase();
                            const hasActiveJob = !!printerStatus.job?.job?.file?.name;
                            
                            console.log(`📊 Job ${job.id} on printer ${job.printer_id}: printer state="${printerState}", hasActiveJob=${hasActiveJob}`);
                            
                            // If printer is operational/idle and has no active job, the print was interrupted
                            if ((printerState === 'operational' || printerState === 'ready') && !hasActiveJob) {
                                console.log(`⚠️ Print job ${job.id} was interrupted - resetting to queued`);
                                await this.db.run(
                                    'UPDATE print_queue SET status = ?, started_at = NULL WHERE id = ?',
                                    ['queued', job.id]
                                );
                            }
                            // If printer is printing but job is completed, mark as completed
                            else if (printerState === 'operational' && hasActiveJob) {
                                const progress = printerStatus.job?.progress?.completion || 0;
                                if (progress >= 100) {
                                    console.log(`✅ Print job ${job.id} completed`);
                                    await this.db.run(
                                        'UPDATE print_queue SET status = ?, completed_at = ?, progress = ? WHERE id = ?',
                                        ['completed', new Date().toISOString(), 100, job.id]
                                    );
                                }
                            }
                        }
                    } catch (error) {
                        console.warn(`⚠️ Could not check status for printer ${job.printer_id}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error syncing queue with printer status:', error);
        }
    }

    // Home all axes
    async homeAxes(printerId) {
        try {
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            
            await client.post('/api/printer/printhead', {
                command: 'home',
                axes: ['x', 'y', 'z']
            });

            return { success: true, message: `Homed all axes on ${printer.name}` };
        } catch (error) {
            console.error(`Error homing axes on printer ${printerId}:`, error.message);
            throw error;
        }
    }

    // Send custom G-code command
    async sendCommand(printerId, command) {
        try {
            const printer = this.getPrinter(printerId);
            if (!printer) {
                throw new Error(`Printer ${printerId} not found`);
            }

            const client = this.createClient(printer);
            
            await client.post('/api/printer/command', {
                command: command
            });

            return { success: true, message: `Command sent to ${printer.name}` };
        } catch (error) {
            console.error(`Error sending command to printer ${printerId}:`, error.message);
            throw error;
        }
    }

    // Estimate print time based on file size (rough estimation)
    estimatePrintTime(fileSize) {
        // Very rough estimation: 1MB ≈ 60 minutes
        // This should be replaced with actual G-code analysis
        const baseSizeInMB = fileSize / (1024 * 1024);
        return Math.round(baseSizeInMB * 60); // minutes
    }
}

module.exports = OctoPrintService;
