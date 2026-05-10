import db from "./firebase.db.connection"

const { Schema, model } = db;

const UserSchema = new Schema({
  user_name: {
    type: String,
    required: [true, 'Username is required'],
    trim: true
  },
  user_number: {
    type: String,
    required: [true, 'User number is required'],
    unique: true 
  },
  contacts: {
    type: [String],
    default: [] 
  }
},{
  timestamps: true
});

export const User = model('User', UserSchema);
