import axios from "axios";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";
import Queue from "bull";
import Redis from "ioredis";

// Configuration Redis
const redisClient = new Redis();

// Configuration SMTP
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: "804025002@smtp-brevo.com",
    pass: "q4mj6RNO507thbTW",
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

// Cache pour les coordonnées des villes
const cityCache = new Map();

// Obtenir les coordonnées de la ville
async function getCityBounds(city) {
  if (cityCache.has(city)) return cityCache.get(city);

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    city
  )}`;
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "CROUS Buddy/1.0 (crousbuddy@gmail.com)" },
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
  params.set("bounds", bounds);
  if (occupationModes) params.set("occupationModes", occupationModes);
  return `https://trouverunlogement.lescrous.fr/tools/37/search?${params.toString()}`;
}

// Fonction principale pour le scraping
async function scrapeWebsite(user) {
  const { email, preferences } = user;
  const { city, occupationModes } = preferences;

  try {
    const url = await generateCrousUrl(city, occupationModes);
    console.log(`[${new Date().toISOString()}] Scraping pour ${email} : ${url}`);

    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const logements = [];
    $(".fr-card").each((index, element) => {
      const title = $(element).find(".fr-card__title").text().trim();
      const link = `https://trouverunlogement.lescrous.fr${$(element)
        .find("a")
        .attr("href")}`;
      logements.push({ title, link });
    });

    return logements;
  } catch (error) {
    console.error(`Erreur lors du scraping pour ${email} :`, error.message);
    throw error;
  }
}

// File d'attente avec Bull
const userQueue = new Queue("userQueue", {
  redis: { host: "127.0.0.1", port: 6379 },
});

// Traitement de la file d'attente
userQueue.process(async (job) => {
  const user = job.data;
  const logements = await scrapeWebsite(user);

  if (logements.length > 0) {
    const message = `
Bonjour,

Nous avons trouvé ${logements.length} nouveaux logements correspondant à vos critères :
- Ville : ${user.preferences.city}
- Mode d'occupation : ${user.preferences.occupationModes}

Voici les détails :
${logements.map((l) => `- ${l.title}\nLien : ${l.link}`).join("\n\n")}

Cordialement,
L'équipe CROUS Buddy
    `;
    await sendEmail(user.email, "Nouveaux logements trouvés", message);
    console.log(`Logements trouvés pour ${user.email}. Notification envoyée.`);
  } else {
    console.log(`Aucun logement trouvé pour ${user.email}.`);
  }
});

// Ajouter un utilisateur à la file d'attente
export function addUserToQueue(user) {
  userQueue.add(user, { attempts: 5, backoff: 30000 }); // Réessayer toutes les 30 secondes
  console.log(`Utilisateur ${user.email} ajouté à la file d'attente.`);
}
