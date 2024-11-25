import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['Student', 'Host'], // Rôle de l'utilisateur
    required: true,
  },
  preferences: {
    city: { type: String, required: false },
    occupationModes: {
      type: String,
      enum: ['house_sharing', 'alone', 'couple'],
      required: function () {
        return this.role === 'Student';
      },
    },
  },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);
export default User;
