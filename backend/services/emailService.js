const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', // Change based on your email provider
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendVerificationEmail(email, verificationCode, username) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Verificatiecode',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <p>Hallo,</p>
                        <p>Gebruik onderstaande code om je account te verifiëren:</p>
                        <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center;">
                            <div style="font-size: 32px; font-weight: bold; color: #e74c3c; margin: 10px 0; letter-spacing: 5px;">
                                ${verificationCode}
                            </div>
                            <p style="margin: 0; color: #7f8c8d; font-size: 14px;">
                                Geldig voor 10 minuten.
                            </p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log(`Verification email sent to ${email}`);
        } catch (error) {
            console.error('Error sending verification email:', error);
            throw error;
        }
    }

    async sendPrintCompletionNotification(email, username, filename, printerName) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Print voltooid',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <p>Hallo,</p>
                        <p>Je print is voltooid en kan opgehaald worden.</p>
                        <div style="background-color: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #27ae60;">
                            <p style="margin: 5px 0;"><strong>Bestand:</strong> ${filename}</p>
                            <p style="margin: 5px 0;"><strong>Printer:</strong> ${printerName}</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log(`Print completion notification sent to ${email}`);
        } catch (error) {
            console.error('Error sending print completion notification:', error);
        }
    }

    async sendPrintFailedNotification(email, username, filename, printerName, reason) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Print mislukt',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <p>Hallo,</p>
                        <p>Je print is mislukt. Probeer het opnieuw of neem contact op voor hulp.</p>
                        <div style="background-color: #fdf2f2; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #e74c3c;">
                            <p style="margin: 5px 0;"><strong>Bestand:</strong> ${filename}</p>
                            <p style="margin: 5px 0;"><strong>Printer:</strong> ${printerName}</p>
                            <p style="margin: 5px 0;"><strong>Reden:</strong> ${reason}</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log(`Print failed notification sent to ${email}`);
        } catch (error) {
            console.error('Error sending print failed notification:', error);
        }
    }

    async testConnection() {
        try {
            await this.transporter.verify();
            console.log('Email service connection verified');
            return true;
        } catch (error) {
            console.error('Email service connection failed:', error);
            return false;
        }
    }
}

module.exports = EmailService;
