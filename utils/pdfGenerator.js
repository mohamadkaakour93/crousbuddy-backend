import fs from 'fs';
import path from 'path';
import pdf from 'html-pdf';
import { fileURLToPath } from 'url';

// Résoudre __dirname pour les modules ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generatePDF(host, student) {
    return new Promise((resolve, reject) => {
        // Définir les chemins pour les templates et les PDFs
        const templatePath = path.join(__dirname, '../templates/attestationTemplate.html');
        const outputDir = path.join(__dirname, '../attestations');

        // Vérifier et créer le répertoire des attestations si nécessaire
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Définir le chemin du fichier PDF
        const fileName = `attestation_${Date.now()}.pdf`;
        const filePath = path.join(outputDir, fileName);

        // Charger le modèle HTML
        fs.readFile(templatePath, 'utf8', (err, htmlTemplate) => {
            if (err) {
                return reject(`Erreur lors du chargement du modèle HTML : ${err.message}`);
            }

            // Remplacer les valeurs dynamiques dans le modèle HTML
            const htmlWithValues = htmlTemplate
                .replace('{{hostName}}', host.name)
                .replace('{{hostBirthDate}}', host.birthDate)
                .replace('{{hostBirthPlace}}', host.birthPlace || 'N/A')
                .replace('{{studentName}}', student.name)
                .replace('{{studentBirthDate}}', student.birthDate)
                .replace('{{studentBirthPlace}}', student.birthPlace || 'N/A')
                .replace('{{hostAddress}}', host.address)
                .replace('{{hostPostalCode}}', host.postalCode)
                .replace('{{hostCity}}', host.city)
                .replace('{{currentDate}}', new Date().toLocaleDateString('fr-FR'));

            // Générer le PDF à partir du HTML
            pdf.create(htmlWithValues, { format: 'A4' }).toFile(filePath, (err, res) => {
                if (err) {
                    return reject(`Erreur lors de la génération du PDF : ${err.message}`);
                }
                resolve(filePath);
            });
        });
    });
}

export default generatePDF;
