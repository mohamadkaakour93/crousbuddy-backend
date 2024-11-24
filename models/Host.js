import mongoose from 'mongoose';

const hostSchema = new mongoose.Schema({
  name: { type: String, required: true },
  birthDate: { type: String, required: true },
  city: { type: String, required: true },
  address: { type: String, required: true },
  houseSize: { type: Number, required: true },
  maxAttestations: { type: Number, default: 0 },
  currentAttestations: { type: Number, default: 0 },
});

// Calcul automatique du nombre maximum d'attestations
hostSchema.pre('save', function (next) {
  if (this.houseSize < 18) {
    throw new Error('La taille de la maison doit être d\'au moins 18m².');
  }
  this.maxAttestations = Math.floor((this.houseSize - 9) / 9);
  next();
});

export default mongoose.model('Host', hostSchema);
