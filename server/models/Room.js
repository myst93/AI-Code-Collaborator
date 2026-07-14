import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  code: { type: String, default: '// Welcome to the Collaborative Editor! Write your code here.\n' },
  language: { type: String, default: 'javascript' },
  chatHistory: [
    {
      id: String,
      username: String,
      message: String,
      timestamp: String,
    }
  ]
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);

export default Room;
