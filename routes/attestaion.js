import express from 'express';
import Host from '../models/Host.js';
import { generatePDF } from '../utils/pdfGenerator.js';
import { sendEmail } from '../utils/emailService.js';
import Student from '../models/Student.js';
import Attestaion from '../models/Attestaion.js';
const router = express.Router();

// Recherche des hébergeurs
router.get('/match-hosts/:city', async (req, res) => {
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

// Génération d'attestation
router.post('/auto-generate-attestation', async (req, res) => {
  const { student, hostId } = req.body;

  try {
    const host = await Host.findById(hostId);
    if (!host || host.currentAttestations >= host.maxAttestations) {
      return res.status(400).json({ error: 'Hébergeur non disponible.' });
    }

    const filePath = await generatePDF(host, student);
    await sendEmail(student.email, 'Votre attestation d’hébergement', 'Veuillez trouver ci-joint votre attestation d’hébergement.', filePath);

    host.currentAttestations += 1;
    await host.save();

    res.status(200).json({ message: 'Attestation générée avec succès.', filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
