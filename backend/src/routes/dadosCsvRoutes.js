const express = require('express');
const router = express.Router();
const dadosCsvController = require('../controllers/dadosCsvController');

router.get('/', dadosCsvController.getDadosCsv);

module.exports = router;
