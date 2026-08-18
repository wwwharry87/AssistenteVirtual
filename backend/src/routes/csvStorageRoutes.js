const express = require('express');
const router = express.Router();
const csvStorageController = require('../controllers/csvStorageController');

const uploadLimit = process.env.CSV_UPLOAD_LIMIT || '50mb';
const rawCsv = express.raw({ type: '*/*', limit: uploadLimit });

// A máquina geradora pode usar PUT (recomendado) ou POST.
router.put(
  '/api/csv/:codigo/:arquivo',
  csvStorageController.requireUploadKey,
  rawCsv,
  csvStorageController.uploadCsv
);
router.post(
  '/api/csv/:codigo/:arquivo',
  csvStorageController.requireUploadKey,
  rawCsv,
  csvStorageController.uploadCsv
);

// Leitura pública do último CSV recebido.
router.get('/csv/:codigo/:arquivo', csvStorageController.serveCsv);

module.exports = router;
