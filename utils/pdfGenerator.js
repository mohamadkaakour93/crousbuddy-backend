const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generatePDF(host, student) {
    return new Promise((resolve, reject) => {
        // Vérifier et créer le répertoire des attestations si nécessaire
        const outputDir = path.join(__dirname, '../attestations');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Définir le chemin du fichier PDF
        const fileName = `attestation_${Date.now()}.pdf`;
        const filePath = path.join(outputDir, fileName);

        // Créer un nouveau document PDF
        const doc = new PDFDocument();

        // Écriture du PDF
        doc.pipe(fs.createWriteStream(filePath));

        // Contenu du PDF
        doc.font('Helvetica-Bold').fontSize(20).text('ATTESTATION D’HÉBERGEMENT', { align: 'center' });
        doc.moveDown();
        
        doc.font('Helvetica').fontSize(12).text(`Je soussigné(e), ${host.name}, né(e) le ${host.birthDate}, à ${host.birthPlace},`);
        doc.text(`déclare sur l'honneur héberger à mon domicile :`);
        doc.moveDown();

        doc.text(`Prénom et Nom : ${student.name}`);
        doc.text(`Date de naissance : ${student.birthDate}`);
        doc.text(`Lieu de naissance : ${student.birthPlace}`);
        doc.moveDown();

        doc.text(`Adresse : ${host.address}`);
        doc.text(`Code postal : ${host.postalCode}`);
        doc.text(`Ville : ${host.city}`);
        doc.moveDown();

        doc.text(`Depuis le : ${new Date().toLocaleDateString('fr-FR')}`);
        doc.text(`Fait à : ${host.city}, le ${new Date().toLocaleDateString('fr-FR')}`);
        doc.moveDown(2);

        doc.text('Signature : ___________________________', { align: 'left' });
        doc.end();

        // Gestion des événements
        doc.on('finish', () => resolve(filePath));
        doc.on('error', (err) => reject(err));
    });
}

module.exports = generatePDF;
