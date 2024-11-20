import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import pLimit from 'p-limit';
import User from './models/User.js'; // Import du modèle User

const userStates = new Map();
const cityCache = new Map();

// Configuration SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: '804025002@smtp-brevo.com',
        pass: 'q4mj6RNO507thbTW'
    }
});

// Envoi des emails
async function sendEmail(to, subject, text) {
    try {
        const info = await transporter.sendMail({
            from: '"CROUS Buddy" <crousbuddy@gmail.com>',
            to,
            subject,
            text
        });
        console.log(`E-mail envoyé avec succès à ${to} :`, info.response);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'e-mail :', error.message);
    }
}

// Obtenir les coordonnées de la ville
async function getCityBounds(city) {
    if (cityCache.has(city)) return cityCache.get(city);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
    const { data } = await axios.get(url);
    if (data.length === 0) throw new Error(`Ville introuvable : ${city}`);

    const { boundingbox } = data[0];
    const bounds = `${boundingbox[2]}_${boundingbox[1]}_${boundingbox[3]}_${boundingbox[0]}`;
    cityCache.set(city, bounds);
    return bounds;
}

// URL de recherche CROUS
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
            isBlocked: false,
            noLogementMailSent: false
        });
    }

    const userState = userStates.get(email);
    if (userState.isBlocked) return;

    const url = await generateCrousUrl(city, occupationModes);
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

        const message = `Nous avons trouvé ${nouveauxLogements.length} nouveaux logements...`;
        await sendEmail(email, 'Logements trouvés', message);
        userState.isBlocked = true;
        userState.noLogementMailSent = false;
    } else if (!userState.noLogementMailSent) {
        await sendEmail(email, 'Aucun logement', 'Aucun logement trouvé...');
        userState.noLogementMailSent = true;
    }
}

// Récupérer les utilisateurs depuis MongoDB
async function getUsersFromDB() {
    return User.find({}, { email: 1, preferences: 1 });
}

// Processus principal
setInterval(async () => {
    const users = await getUsersFromDB();
    if (users.length > 0) {
        const limit = pLimit(5);
        await Promise.all(users.map((user) => limit(() => scrapeWebsite(user))));
    } else {
        console.log('Aucun utilisateur trouvé.');
    }
}, 60000);
