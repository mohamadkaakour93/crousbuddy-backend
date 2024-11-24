import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendEmail(to, subject, text, filePath) {
  try {
    await transporter.sendMail({
      from: '"CROUS Buddy" <crousbuddy@gmail.com>',
      to,
      subject,
      text,
      attachments: [{ filename: 'attestation.pdf', path: filePath }],
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email :', error.message);
  }
}
