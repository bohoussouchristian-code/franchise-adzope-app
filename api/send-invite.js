// Fonction serverless Vercel : envoie par e-mail le mot de passe d'un
// nouvel administrateur via l'API Resend. Nécessite la variable
// d'environnement RESEND_API_KEY dans les paramètres du projet Vercel
// (Settings > Environment Variables), sinon renvoie une erreur claire.

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "RESEND_API_KEY n'est pas configurée sur le serveur." });
    return;
  }

  const { to, name, password, appName } = req.body || {};
  if (!to || !password) {
    res.status(400).json({ error: 'Champs manquants (destinataire ou mot de passe).' });
    return;
  }

  const safeApp = escapeHtml(appName || 'OmnySyncBase');
  const safeName = escapeHtml(name || '');
  const safeTo = escapeHtml(to);
  const safePassword = escapeHtml(password);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'onboarding@resend.dev',
        to,
        subject: `Votre accès administrateur — ${safeApp}`,
        html: `
          <p>Bonjour ${safeName},</p>
          <p>Un compte administrateur vient d'être créé pour vous sur <b>${safeApp}</b>.</p>
          <p>
            Identifiant : <b>${safeTo}</b><br>
            Mot de passe temporaire : <b>${safePassword}</b>
          </p>
          <p>Nous vous recommandons de changer ce mot de passe après votre première connexion (menu Paramètres).</p>
        `,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      res.status(502).json({ error: "Le service d'e-mail a refusé l'envoi.", details });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erreur inconnue lors de l'envoi." });
  }
};
