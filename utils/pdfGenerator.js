import fs from 'fs';
import PDFDocument from 'pdfkit';

export function generatePDF(host, student) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const filePath = `./attestations/attestation_${Date.now()}.pdf`;

    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(20).text('ATTESTATION D\'HÉBERGEMENT', { align: 'center' }).moveDown(2);
    doc.fontSize(14).text(`Je soussigné(e) ${host.name}, né(e) le ${host.birthDate}, à ${host.city}, déclare sur l'honneur héberger ${student.name}, né(e) le ${student.birthDate}, à ${student.city}, depuis le ${new Date().toLocaleDateString()}.`, { align: 'left' });
    doc.moveDown();
    doc.text(`Adresse : ${host.address}`);
    doc.text(`Taille de la maison : ${host.houseSize}m²`);
    doc.text(`Signature : ________________`, { align: 'center' });

    doc.end();
    doc.on('finish', () => resolve(filePath));
    doc.on('error', (err) => reject(err));
  });
}
