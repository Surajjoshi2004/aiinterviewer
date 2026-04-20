const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error('MONGO_URI is required in .env');
  process.exit(1);
}

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

module.exports = mongoose;
