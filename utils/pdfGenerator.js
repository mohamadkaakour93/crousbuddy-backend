import fs from 'fs';
import path from 'path';
import pdf from 'html-pdf';
import { fileURLToPath } from 'url';

// Résoudre __dirname pour les modules ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generatePDF(host, student) {
  return new Promise((resolve, reject) => {
    // Charger le modèle HTML
    const templatePath = path.join(__dirname, '../templates/attestationTemplate.html');
    const htmlTemplate = fs.readFileSync(templatePath, 'utf8');

    // Remplacer les variables dynamiques dans le HTML
    const htmlWithValues = htmlTemplate
    .replace('{{hostName}}', host.name)
    .replace('{{hostBirthDate}}', host.birthDate)
    .replace('{{hostAddress}}', host.address)
    .replace('{{hostPostalCode}}', host.postalCode)
    .replace('{{hostCity}}', host.city)
    .replace('{{studentName}}', student.name)
    .replace('{{studentBirthDate}}', student.birthDate)
    .replace('{{startDate}}', new Date().toLocaleDateString('fr-FR')) // Date dynamique
    .replace('{{currentDate}}', new Date().toLocaleDateString('fr-FR'));
    // Définir le chemin du fichier PDF
    const outputDir = path.join(__dirname, '../attestations');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const fileName = `attestation_${Date.now()}.pdf`;
    const filePath = path.join(outputDir, fileName);

    // Générer le PDF
    pdf.create(htmlWithValues).toFile(filePath, (err, res) => {
      if (err) {
        reject(new Error(`Erreur lors de la génération du PDF : ${err.message}`));
      } else {
        resolve(filePath);
      }
    });
  });
}

export default generatePDF;
