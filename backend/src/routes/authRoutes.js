const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/verificar-usuario', authController.verificarUsuario);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

module.exports = router;
