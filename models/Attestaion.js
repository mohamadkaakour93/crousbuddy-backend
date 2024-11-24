import mongoose from 'mongoose';

const attestationSchema = new mongoose.Schema({
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'Host', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  generatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Attestation', attestationSchema);
