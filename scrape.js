import axios from "axios";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";
import User from "./models/User.js";

// États pour chaque utilisateur (stockage temporaire)
const userStates = new Map();
const cityCache = new Map(); // Cache pour les coordonnées des villes

// Configuration SMTP pour envoyer des e-mails
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

// Fonction pour obtenir les coordonnées (bounds) d'une ville
async function getCityBounds(city) {
  if (cityCache.has(city)) return cityCache.get(city);

  try {
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
  } catch (error) {
    console.error(`Erreur lors de la récupération des bounds pour ${city} :`, error.message);
    throw error;
  }
}

// Fonction pour générer l'URL de recherche CROUS
async function generateCrousUrl(city, occupationModes) {
  const bounds = await getCityBounds(city); // Obtenez les coordonnées de la ville
  const params = new URLSearchParams();
  params.set("bounds", bounds);
  if (occupationModes) params.set("occupationModes", occupationModes);
  return `https://trouverunlogement.lescrous.fr/tools/37/search?${params.toString()}`;
}

// Fonction principale de scraping
async function scrapeWebsite(userId) {
  try {
    // Récupérer l'utilisateur à partir de la base de données
    const user = await User.findById(userId).select("email preferences");
    if (!user) {
      console.error(`Utilisateur avec l'ID ${userId} introuvable.`);
      return false;
    }

    const { email, preferences } = user;
    const { city, occupationModes } = preferences;

    // Générer l'URL de recherche
    const url = await generateCrousUrl(city, occupationModes);
    console.log(`[${new Date().toISOString()}] Scraping pour ${email} : ${url}`);

    // Effectuer le scraping
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

    const userState = userStates.get(userId);

    if (logements.length > 0) {
      const message = `
Bonjour,

Nous avons trouvé ${logements.length} nouveaux logements correspondant à vos critères :
- Ville : ${city}
- Mode d'occupation : ${occupationModes}

Voici les détails :
${logements.map((l) => `- ${l.title}\nLien : ${l.link}`).join("\n\n")}

Cordialement,
L'équipe CROUS Buddy
      `;
      await sendEmail(email, "Nouveaux logements trouvés", message);
      console.log(`Logements trouvés pour ${email}. Notification envoyée.`);
      return true; // Recherche terminée pour cet utilisateur
    } else if (!userState.noLogementMailSent) {
      // Si aucun logement n'est trouvé, envoyer un e-mail une seule fois
      const noLogementMessage = `
Bonjour,

Actuellement, aucun logement correspondant à vos critères n'est disponible.
Nous continuerons à chercher et vous tiendrons informé dès qu’un logement sera trouvé.

Cordialement,
L'équipe CROUS Buddy
      `;
      await sendEmail(email, "Aucun logement disponible", noLogementMessage);
      userState.noLogementMailSent = true; // Marquer que l'e-mail a été envoyé
      console.log(`Notification "aucun logement" envoyée à ${email}.`);
    }

    console.log(`Aucun logement trouvé pour ${email}. Nouvelle tentative dans 30 secondes.`);
    return false; // Continuer la recherche
  } catch (error) {
    console.error(`Erreur lors du scraping pour l'utilisateur avec l'ID ${userId} :`, error.message);
    return false;
  }
}

// Boucle de recherche continue pour chaque utilisateur
async function startSearchLoop(userId) {
  if (!userStates.has(userId)) {
    userStates.set(userId, { noLogementMailSent: false }); // Initialiser l'état de l'utilisateur
  }

  let logementTrouve = false;
  while (!logementTrouve) {
    logementTrouve = await scrapeWebsite(userId);
    if (!logementTrouve) {
      await new Promise((resolve) => setTimeout(resolve, 30000)); // Attendre 30 secondes avant de relancer
    }
  }
  console.log(`Recherche terminée pour l'utilisateur avec l'ID ${userId}.`);
}

// Fonction pour gérer les utilisateurs en parallèle
export function addUserToSearch(userId) {
  console.log(`Lancement de la recherche automatique pour l'utilisateur avec l'ID ${userId}.`);
  startSearchLoop(userId); // Démarrer une recherche continue pour cet utilisateur
}
