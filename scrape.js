import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';

// État pour chaque utilisateur connecté
const userStates = new Map();
const cityCache = new Map();
const scrapingQueue = []; // File d'attente pour les utilisateurs

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
        console.error("Erreur lors de l'envoi de l'e-mail :", error.message);
    }
}

// Fonction pour obtenir les coordonnées d'une ville
async function getCityBounds(city) {
    if (cityCache.has(city)) return cityCache.get(city);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
    const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'CROUS Buddy/1.0 (crousbuddy@gmail.com)' },
    });

    if (data.length === 0) throw new Error(`Ville introuvable : ${city}`);

    const { boundingbox } = data[0];
    const bounds = `${boundingbox[2]}_${boundingbox[1]}_${boundingbox[3]}_${boundingbox[0]}`;
    cityCache.set(city, bounds);
    return bounds;
}

// Fonction pour générer l'URL de recherche CROUS
async function generateCrousUrl(city, occupationModes) {
    const bounds = await getCityBounds(city);
    const params = new URLSearchParams();
    params.set('bounds', bounds);
    if (occupationModes) params.set('occupationModes', occupationModes);
    return `https://trouverunlogement.lescrous.fr/tools/37/search?${params.toString()}`;
}

// Fonction principale pour le scraping
async function performScrape(user) {
    const { email, preferences } = user;
    const { city, occupationModes } = preferences;

    try {
        const url = await generateCrousUrl(city, occupationModes);
        console.log(`[${new Date().toISOString()}] Scraping pour ${email} : ${url}`);

        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const logements = [];
        $('.fr-card').each((index, element) => {
            const title = $(element).find('.fr-card__title').text().trim();
            const link = `https://trouverunlogement.lescrous.fr${$(element).find('a').attr('href')}`;
            logements.push({ title, link });
        });

        const userState = userStates.get(email);
        const nouveauxLogements = logements.filter(
            (logement) => !userState.notifiedLogements.has(logement.link)
        );

        if (nouveauxLogements.length > 0) {
            for (const logement of nouveauxLogements)
                userState.notifiedLogements.add(logement.link);

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
            console.log(`Logements trouvés pour ${email}. Notification envoyée.`);
            return true; // Indique que des logements ont été trouvés
        } else {
            console.log(`Aucun logement trouvé pour ${email}.`);
            return false; // Aucun logement trouvé
        }
    } catch (error) {
        console.error(`Erreur lors du scraping pour ${email} :`, error.message);
        return false; // Échec du scraping
    }
}

// Gestion de la file d'attente
async function processQueue() {
    while (true) {
        if (scrapingQueue.length === 0) {
            console.log('La queue est vide. En attente de nouveaux utilisateurs.');
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Pause de 5 secondes
            continue;
        }

        const user = scrapingQueue.shift(); // Retirer un utilisateur de la queue
        console.log(`Traitement de la queue : ${scrapingQueue.length} utilisateurs restants.`);

        const userState = userStates.get(user.email);
        const intervalId = setInterval(async () => {
            const result = await performScrape(user);
            if (result) {
                clearInterval(intervalId); // Arrêter le scraping une fois qu'un logement est trouvé
                userStates.delete(user.email); // Supprimer l'état de l'utilisateur
            }
        }, 30000); // Intervalle de 30 secondes entre chaque tentative
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Pause de 1 seconde entre les utilisateurs
    }
}

// Ajouter un utilisateur à la queue
export function addUserToQueue(user) {
    const { email } = user;

    if (!userStates.has(email)) {
        userStates.set(email, {
            notifiedLogements: new Set(),
        });
        scrapingQueue.push(user);
        console.log(`Utilisateur ${email} ajouté à la queue.`);
    } else {
        console.log(`Utilisateur ${email} est déjà en cours de traitement.`);
    }
}

// Lancer le traitement de la queue
processQueue();
