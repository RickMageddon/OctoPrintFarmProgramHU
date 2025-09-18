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
                subject: 'Printmeister - Email Verificatie',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2c3e50;">Printmeister - Email Verificatie</h2>
                        
                        <p>Hallo <strong>${username}</strong>,</p>
                        
                        <p>Bedankt voor het registreren bij Printmeister. Om je account te activeren, 
                        hebben we een verificatiecode naar je HU email adres gestuurd.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center;">
                            <h3 style="margin: 0; color: #2c3e50;">Je verificatiecode is:</h3>
                            <div style="font-size: 32px; font-weight: bold; color: #e74c3c; margin: 10px 0; letter-spacing: 5px;">
                                ${verificationCode}
                            </div>
                            <p style="margin: 0; color: #7f8c8d; font-size: 14px;">
                                Deze code is 10 minuten geldig.
                            </p>
                        </div>
                        
                        <p>Voer deze code in op de verificatiepagina om je account te activeren.</p>
                        
                        <p style="color: #7f8c8d; font-size: 14px;">
                            Als je dit account niet hebt aangemaakt, kun je deze email negeren.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
                        
                        <p style="color: #7f8c8d; font-size: 12px;">
                            Printmeister<br>
                            Hogeschool Utrecht<br>
                            Dit is een automatisch gegenereerde email.
                        </p>
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
                subject: 'Printmeister - Print Voltooid',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #27ae60;">🎉 Print Voltooid!</h2>
                        
                        <p>Hallo <strong>${username}</strong>,</p>
                        
                        <p>Goed nieuws! Je print is succesvol voltooid.</p>
                        
                        <div style="background-color: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #27ae60;">
                            <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Print Details:</h3>
                            <p style="margin: 5px 0;"><strong>Bestand:</strong> ${filename}</p>
                            <p style="margin: 5px 0;"><strong>Printer:</strong> ${printerName}</p>
                            <p style="margin: 5px 0;"><strong>Voltooid op:</strong> ${new Date().toLocaleString('nl-NL')}</p>
                        </div>
                        
                        <p>Je kunt je print nu ophalen bij de ${printerName}.</p>
                        
                        <p><a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ga naar Dashboard</a></p>
                        
                        <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
                        
                        <p style="color: #7f8c8d; font-size: 12px;">
                            Printmeister<br>
                            Hogeschool Utrecht
                        </p>
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
                subject: 'Printmeister - Print Mislukt',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #e74c3c;">⚠️ Print Mislukt</h2>
                        
                        <p>Hallo <strong>${username}</strong>,</p>
                        
                        <p>Helaas is je print mislukt. Hier zijn de details:</p>
                        
                        <div style="background-color: #fdf2f2; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #e74c3c;">
                            <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Print Details:</h3>
                            <p style="margin: 5px 0;"><strong>Bestand:</strong> ${filename}</p>
                            <p style="margin: 5px 0;"><strong>Printer:</strong> ${printerName}</p>
                            <p style="margin: 5px 0;"><strong>Mislukt op:</strong> ${new Date().toLocaleString('nl-NL')}</p>
                            <p style="margin: 5px 0;"><strong>Reden:</strong> ${reason}</p>
                        </div>
                        
                        <p>Je kunt proberen je bestand opnieuw toe te voegen aan de wachtrij, of contact opnemen met de beheerders voor hulp.</p>
                        
                        <p><a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ga naar Dashboard</a></p>
                        
                        <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
                        
                        <p style="color: #7f8c8d; font-size: 12px;">
                            Printmeister<br>
                            Hogeschool Utrecht
                        </p>
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
