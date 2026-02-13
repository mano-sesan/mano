/**
 * @param {string} name
 * @param {boolean} isAdmin
 * @param {string} responsible
 * @returns {string}
 */
function mailDesactivationHtml(name, isAdmin, responsible) {
  const resp = responsible || "Guillaume";
  return `<img src="https://espace-mano.sesan.fr/banner-top.png" width="700" alt="Mano" style="margin-bottom: 16px;" />
<div style="max-width: 700px; padding: 8px">
<p>Bonjour${name ? " " + name : ""},</p>
<p>Nous vous informons que votre compte Mano a été <b>désactivé</b> en raison d'une inactivité de plus de 3 mois.</p>
<p>Vous ne pouvez plus vous connecter à l'application.</p>
<br />
${
  isAdmin
    ? `<p>En tant qu'administrateur, pour réactiver votre compte, veuillez contacter votre chargé·e de déploiement&nbsp;:</p>
${
  resp === "Melissa"
    ? `<p><b>Melissa SAITER</b><br />
melissa.saiter@sesan.fr<br />
07 49 08 27 10</p>
<p><b>Votre référent n'est pas disponible&nbsp;?</b></p>
<ul>
<li>Simon - 06 62 94 76 88 - simon.lesgourgues@sesan.fr</li>
<li>Guillaume - 07 68 55 81 48 - guillaume.demirhan@sesan.fr</li>
</ul>`
    : resp === "Simon"
    ? `<p><b>Simon LESGOURGUES</b><br />
simon.lesgourgues@sesan.fr<br />
06 62 94 76 88</p>
<p><b>Votre référent n'est pas disponible&nbsp;?</b></p>
<ul>
<li>Melissa - 07 49 08 27 10 - melissa.saiter@sesan.fr</li>
<li>Guillaume - 07 68 55 81 48 - guillaume.demirhan@sesan.fr</li>
</ul>`
    : `<p><b>Guillaume DEMIRHAN</b><br />
guillaume.demirhan@sesan.fr<br />
07 68 55 81 48</p>
<p><b>Votre référent n'est pas disponible&nbsp;?</b></p>
<ul>
<li>Melissa - 07 49 08 27 10 - melissa.saiter@sesan.fr</li>
<li>Simon - 06 62 94 76 88 - simon.lesgourgues@sesan.fr</li>
</ul>`
}`
    : `<p>Pour réactiver votre accès, veuillez vous rapprocher d'un administrateur de votre organisation.</p>`
}
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
  mailDesactivationHtml,
};
