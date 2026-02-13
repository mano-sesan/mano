/**
 * @param {string} name
 * @returns {string}
 */
function mailDesactivationWarningHtml(name) {
  return `<img src="https://espace-mano.sesan.fr/banner-top.png" width="700" alt="Mano" style="margin-bottom: 16px;" />
<div style="max-width: 700px; padding: 8px">
<p>Bonjour${name ? " " + name : ""},</p>
<p>Nous vous informons que votre compte Mano sera <b>désactivé dans 15 jours</b> en raison d'une inactivité de plus de 2 mois et demi.</p>
<p>Pour éviter la désactivation de votre compte, il vous suffit de vous reconnecter&nbsp;:</p>
<p><a href="https://espace-mano.sesan.fr/">👉 Me connecter à Mano 👈</a></p>
<p>Si vous ne vous reconnectez pas d'ici 15 jours, votre compte sera automatiquement désactivé et vous ne pourrez plus accéder à l'application.</p>
<br />
<p>Cordialement,</p>
<p>L'équipe Mano</p>
<a href="https://espace-mano.sesan.fr/" style="margin-top: 16px;">
<img src="https://espace-mano.sesan.fr/banner-bottom.png" width="700" alt="Mano" />
</a>
</div>
`;
}

module.exports = {
  mailDesactivationWarningHtml,
};
