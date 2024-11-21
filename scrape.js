// scrape.js

import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';

// Queue des utilisateurs pour le scraping
const userQueue = [];

// Cache pour les coordonnées des villes
const cityCache = new Map();

// Configuration SMTP (remplacez par vos propres informations)
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: 'votre_adresse_email@exemple.com', // Remplacez par votre adresse e-mail SMTP
    pass: 'votre_mot_de_passe',              // Remplacez par votre mot de passe SMTP
  },
});

// Fonction pour envoyer un e-mail
async function sendEmail(to, subject, text) {
    try {
      const info = await transporter.sendMail({
        from: '"CROUS Buddy" <crousbuddy@gmail.com>', // Remplacez par votre adresse e-mail d'envoi
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
    const { data } = await axios.get(url);
  
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
  
  // Fonction principale pour le scraping
  async function scrapeWebsite(user) {
    const { email, preferences } = user;
    const { city, occupationModes } = preferences;
  
    try {
      const url = await generateCrousUrl(city, occupationModes);
      console.log(`[${new Date().toISOString()}] Scraping pour ${email} avec URL : ${url}`);
  
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
  
      const logements = [];
      $('.fr-card').each((index, element) => {
        const title = $(element).find('.fr-card__title').text().trim();
        const link = `https://trouverunlogement.lescrous.fr${$(element).find('a').attr('href')}`;
        logements.push({ title, link });
      });
  
      return logements.length > 0 ? { logements, success: true } : { logements: [], success: false };
    } catch (error) {
      console.error(`Erreur lors du scraping pour ${email} :`, error.message);
      return { logements: [], success: false };
    }
  }
  
  // Fonction pour gérer le processus de scraping
  async function processUser(user) {
    const { email, preferences } = user;
  
    const result = await scrapeWebsite(user);
    if (result.success && result.logements.length > 0) {
      const message = `
  Bonjour,
  
  Nous avons trouvé ${result.logements.length} nouveaux logements correspondant à vos critères :
  - Ville : ${preferences.city}
  - Mode d'occupation : ${preferences.occupationModes}
  
  Voici les détails :
  ${result.logements.map((l) => `- ${l.title}\nLien : ${l.link}`).join('\n\n')}
  
  Cordialement,
  L'équipe CROUS Buddy
  `;
      await sendEmail(email, 'Nouveaux logements trouvés', message);
  
      // Retirer l'utilisateur de la queue une fois qu'un logement est trouvé
      console.log(`Logements trouvés pour ${email}. Retrait de la queue.`);
      const index = userQueue.findIndex((u) => u.email === email);
      if (index !== -1) userQueue.splice(index, 1);
    } else {
      console.log(`Aucun logement trouvé pour ${email}. Recherche toujours en cours.`);
    }
  }
  
  // Fonction pour ajouter un utilisateur à la queue
  export function addUserToQueue(user) {
    if (!userQueue.find((u) => u.email === user.email)) {
      userQueue.push(user);
      console.log(`Utilisateur ${user.email} ajouté à la queue.`);
    } else {
      console.log(`Utilisateur ${user.email} est déjà en cours de traitement.`);
    }
  }
  
  // Intervalle global pour traiter la queue
  setInterval(async () => {
    if (userQueue.length > 0) {
      console.log(`Traitement de la queue : ${userQueue.length} utilisateurs en attente.`);
      for (const user of [...userQueue]) {
        await processUser(user);
      }
    } else {
      console.log('La queue est vide. En attente de nouveaux utilisateurs.');
    }
  }, 300000); // Exécution toutes les 5 minutes