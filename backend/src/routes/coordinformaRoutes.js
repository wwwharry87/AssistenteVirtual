const express = require('express');
const router = express.Router();
const coordinformaController = require('../controllers/coordinformaController');

router.post('/send-messages', coordinformaController.sendMessages);

module.exports = router;
