import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';

const userStates = new Map(); // État individuel pour chaque utilisateur
const cityCache = new Map(); // Cache pour les coordonnées des villes

// Configuration SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: '804025002@smtp-brevo.com',
        pass: 'q4mj6RNO507thbTW',
    },
});

// Fonction pour envoyer un e-mail
async function sendEmail(to, subject, text) {
    try {
        const info = await transporter.sendMail({
            from: '"CROUS Buddy" <crousbuddy@gmail.com>',
            to,
            subject,
            text,
        });
        console.log(`E-mail envoyé avec succès à ${to} :`, info.response);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'e-mail :', error.message);
    }
}

// Fonction pour obtenir les coordonnées d'une ville
async function getCityBounds(city) {
    if (cityCache.has(city)) return cityCache.get(city);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
    const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'CROUS Buddy/1.0 (crousbuddy@gmail.com)' }
        });

    if (data.length === 0) throw new Error(`Ville introuvable : ${city}`);

    const { boundingbox } = data[0];
    const bounds = `${boundingbox[2]}_${boundingbox[1]}_${boundingbox[3]}_${boundingbox[0]}`;
    cityCache.set(city, bounds);
    return bounds;
}

// Générer l'URL de recherche CROUS
async function generateCrousUrl(city, occupationModes) {
    const bounds = await getCityBounds(city);
    const params = new URLSearchParams();
    params.set('bounds', bounds);
    if (occupationModes) params.set('occupationModes', occupationModes);
    return `https://trouverunlogement.lescrous.fr/tools/37/search?${params.toString()}`;
}

// Scraper le site
export async function scrapeWebsite(user) {
    const { email, preferences } = user;
    const { city, occupationModes } = preferences;

    if (!userStates.has(email)) {
        userStates.set(email, {
            notifiedLogements: new Set(),
            noLogementMailSent: false,
        });
    }

    const userState = userStates.get(email);

    async function performScrape() {
        try {
            const url = await generateCrousUrl(city, occupationModes);
            console.log(`[${new Date().toISOString()}] Lancement du scraping pour ${email} avec URL : ${url}`);

            const { data } = await axios.get(url);
            const $ = cheerio.load(data);

            const logements = [];
            $('.fr-card').each((index, element) => {
                const title = $(element).find('.fr-card__title').text().trim();
                const link = `https://trouverunlogement.lescrous.fr${$(element).find('a').attr('href')}`;
                logements.push({ title, link });
            });

            const nouveauxLogements = logements.filter((logement) => !userState.notifiedLogements.has(logement.link));

            if (nouveauxLogements.length > 0) {
                for (const logement of nouveauxLogements) userState.notifiedLogements.add(logement.link);

                const message = `
Bonjour,

Nous avons trouvé ${nouveauxLogements.length} nouveaux logements correspondant à vos critères :
- Ville : ${city}
- Mode d'occupation : ${occupationModes}

Voici les détails :
${nouveauxLogements.map((l) => `- ${l.title}\nLien : ${l.link}`).join('\n\n')}

Cordialement,  
L'équipe CROUS Buddy
`;
                await sendEmail(email, 'Nouveaux logements trouvés', message);
                console.log(`E-mail envoyé à ${email} avec ${nouveauxLogements.length} logements.`);
            } else if (!userState.noLogementMailSent) {
                const noLogementMessage = `
Bonjour,

Actuellement, aucun logement correspondant à vos critères n'est disponible.  
Nous continuerons à chercher et vous tiendrons informé dès qu’un logement sera trouvé.

Cordialement,  
L'équipe CROUS Buddy
`;
                await sendEmail(email, 'Aucun logement disponible', noLogementMessage);
                userState.noLogementMailSent = true;
                console.log(`E-mail "aucun logement trouvé" envoyé à ${email}.`);
            }
        } catch (error) {
            console.error(`Erreur lors du scraping pour ${email} :`, error.message);
        }
    }

    // Lancer le scraping toutes les 5 minutes
    const intervalId = setInterval(async () => {
        const logements = await performScrape();
        if (logements && logements.length > 0) {
            clearInterval(intervalId); // Arrêter le scraping une fois des logements trouvés
        }
    }, 60000); // 5 minutes
}
