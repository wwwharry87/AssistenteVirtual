// backend/src/routes/whatsappCloudRoutes.js
const express = require("express");
const { sendText, sendTemplate } = require("../services/whatsappCloud");

const router = express.Router();

/**
 * POST /whatsapp-cloud/test-text
 * body: { to: "+55XXXXXXXXXXX", body: "Olá" }
 */
router.post("/whatsapp-cloud/test-text", async (req, res) => {
  try {
    const { to, body } = req.body || {};
    const result = await sendText(to, body || "Olá do AssistenteVirtual 🎉");
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err?.response?.data || String(err) });
  }
});

/**
 * POST /whatsapp-cloud/test-template
 * body: { to: "+55...", name: "confirmacao_entrega", vars: ["REQ-123", "2 cx leite"] }
 */
router.post("/whatsapp-cloud/test-template", async (req, res) => {
  try {
    const { to, name, vars } = req.body || {};
    const components = Array.isArray(vars) && vars.length
      ? [{ type: "body", parameters: vars.map((v) => ({ type: "text", text: String(v) })) }]
      : undefined;

    const result = await sendTemplate(to, name, "pt_BR", components);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err?.response?.data || String(err) });
  }
});

module.exports = router;
