const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://total-prod-frontend.vercel.app',
    'http://192.168.100.193:3000',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://localhost:8080'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = corsOptions;
