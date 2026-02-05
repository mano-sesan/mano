const express = require("express");
const router = express.Router();
const passport = require("passport");
const { z } = require("zod");
const { catchErrors } = require("../errors");
const { sendEmailWithAttachment } = require("../utils/mailservice");
const validateUser = require("../middleware/validateUser");

// Max PDF size: 10MB (base64 encoded = ~13.3MB string)
const MAX_PDF_BASE64_LENGTH = 14 * 1024 * 1024;

// Sanitize filename to prevent path traversal and special characters
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .substring(0, 200);
};

// Escape HTML to prevent XSS
const escapeHtml = (str) => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

router.post(
  "/email",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal"]),
  catchErrors(async (req, res) => {
    const bodySchema = z.object({
      email: z.string().email(),
      subject: z.string().min(1).max(200),
      pdfBase64: z.string().min(1).max(MAX_PDF_BASE64_LENGTH),
      filename: z.string().min(1).max(200),
    });

    const { email, subject, pdfBase64, filename } = bodySchema.parse(req.body);

    const user = req.user;
    const safeFilename = sanitizeFilename(filename);
    const safeName = escapeHtml(user.name);

    const html = `
      <p>Bonjour,</p>
      <p>${safeName} vous envoie un dossier via l'application Mano.</p>
      <p>Vous trouverez le document en pièce jointe.</p>
      <p>Cordialement,<br/>L'équipe Mano</p>
    `;

    const text = `Bonjour,

${user.name} vous envoie un dossier via l'application Mano.

Vous trouverez le document en pièce jointe.

Cordialement,
L'équipe Mano`;

    await sendEmailWithAttachment(email, subject, text, html, [
      {
        filename: safeFilename,
        content: Buffer.from(pdfBase64, "base64"),
        contentType: "application/pdf",
      },
    ]);

    return res.status(200).json({ ok: true });
  })
);

module.exports = router;
