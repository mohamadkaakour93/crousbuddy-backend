import express from 'express';
import Host from '../models/Host.js';
import { sendEmail } from '../utils/emailService.js';
import { authMiddleware } from '../middleware/auth.js';
import Student from '../models/Student.js';
import Attestaion from '../models/Attestaion.js';
import generatePDF from '../utils/pdfGenerator.js';
const router = express.Router();

// Recherche des hébergeurs avec authentification
router.get('/match-hosts/:city', authMiddleware, async (req, res) => {
    const city = req.params.city;
  
    try {
      const hosts = await Host.find({
        city,
        $expr: { $gt: ["$maxAttestations", "$currentAttestations"] },
      });
  
      if (hosts.length === 0) {
        return res.status(404).json({ error: 'Aucun hébergeur disponible pour cette ville.' });
      }
  
      res.status(200).json(hosts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  

  

  router.post('/auto-generate-attestation', async (req, res) => {
      const { student, hostId } = req.body;
  
      try {
          const host = await Host.findById(hostId);
          if (!host || host.currentAttestations >= host.maxAttestations) {
              return res.status(400).json({ error: 'Hébergeur non disponible.' });
          }
          console.time('PDF Generation'); // Démarrer le chronomètre pour la génération du PDF
    
  
          // Générer le PDF
          const filePath = await generatePDF(host, student);
          console.timeEnd('PDF Generation'); 
  
          console.time('Email Sending');
          // Envoyer l'email avec l'attestation en pièce jointe
          await sendEmail(
              student.email,
              'Votre attestation d’hébergement',
              'Veuillez trouver ci-joint votre attestation d’hébergement.',
              filePath
          );
          console.timeEnd('Email Sending');
  
          // Mettre à jour le compteur d'attestations de l'hébergeur
          host.currentAttestations += 1;
          await host.save();
  
          res.status(200).json({ message: 'Attestation générée avec succès.', filePath });
      } catch (err) {
          console.error('Erreur lors de la génération de l’attestation :', err);
          res.status(500).json({ error: err.message });
      }
  });
  
  
export default router;
