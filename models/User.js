import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    preferences: {
        city: { type: String, required: true },
        occupationModes: {
            type: String,
            enum: ['house_sharing', 'alone', 'couple'],
            required: true
        }
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
export default User;

