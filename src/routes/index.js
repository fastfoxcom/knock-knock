const express = require('express');

const routes = express.Router();

// Controllers
const { sendDiffusionReminder } = require('src/routes/controllers/diffusion');

// Ping route
routes.get('/ping', (req, res) => {
  res.json({
    statusCode: '2XX',
    version: 'A',
    data: 'pong',
  });
});

// Healthcheck route
routes.get('/healthcheck', (req, res) => {
  res.json({
    statusCode: '2XX',
    version: 'A',
    data: [],
  });
});

// Lead routes
routes.get('/v1/sendDiffusionReminder', sendDiffusionReminder);


module.exports = routes;
