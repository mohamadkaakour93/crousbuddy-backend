import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

// Résoudre __dirname pour les modules ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generatePDF(host, student) {
    try {
        // Charger le modèle HTML
        const templatePath = path.join(__dirname, '../templates/attestationTemplate.html');
        const htmlTemplate = fs.readFileSync(templatePath, 'utf8');

        // Remplacer les valeurs dynamiques dans le modèle HTML
        const htmlWithValues = htmlTemplate
            .replace('{{hostName}}', host.name)
            .replace('{{hostBirthDate}}', host.birthDate)
            .replace('{{hostBirthPlace}}', host.birthPlace || 'Non spécifié')
            .replace('{{studentName}}', student.name)
            .replace('{{studentBirthDate}}', student.birthDate)
            .replace('{{studentBirthPlace}}', student.birthPlace || 'Non spécifié')
            .replace('{{hostAddress}}', host.address)
            .replace('{{hostPostalCode}}', host.postalCode)
            .replace('{{hostCity}}', host.city)
            .replace('{{currentDate}}', new Date().toLocaleDateString('fr-FR'));

        // Lancer Puppeteer pour générer le PDF
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
          });
        const page = await browser.newPage();
        await page.setContent(htmlWithValues);

        // Définir le chemin de sortie du fichier PDF
        const outputDir = path.join(__dirname, '../attestations');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const fileName = `attestation_${Date.now()}.pdf`;
        const filePath = path.join(outputDir, fileName);

        // Créer le fichier PDF
        await page.pdf({
            path: filePath,
            format: 'A4',
            printBackground: true,
        });

        await browser.close();

        return filePath;
    } catch (err) {
        throw new Error(`Erreur lors de la génération du PDF : ${err.message}`);
    }
}

export default generatePDF;
