const express = require('express');
const router = express.Router();
const respinformaController = require('../controllers/respinformaController');

router.post('/send-messages', respinformaController.sendMessages);

module.exports = router;
