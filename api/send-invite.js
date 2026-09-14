// Fonction serverless Vercel : envoie par e-mail le mot de passe d'un
// nouvel administrateur via l'API Brevo (ex-Sendinblue). Nécessite la
// variable d'environnement BREVO_API_KEY dans les paramètres du projet
// Vercel (Settings > Environment Variables), sinon renvoie une erreur
// claire. BREVO_FROM_EMAIL doit être une adresse expéditrice vérifiée
// dans le compte Brevo (Settings > Senders), sinon l'envoi est refusé.

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

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "BREVO_API_KEY n'est pas configurée sur le serveur." });
    return;
  }
  if (!process.env.BREVO_FROM_EMAIL) {
    res.status(500).json({ error: "BREVO_FROM_EMAIL n'est pas configurée (adresse expéditrice vérifiée dans Brevo)." });
    return;
  }

  const { to, name, password, appName, loginIdentifier, codeLabel } = req.body || {};
  if (!to || !password) {
    res.status(400).json({ error: 'Champs manquants (destinataire ou mot de passe).' });
    return;
  }

  const safeApp = escapeHtml(appName || 'OmnySyncBase');
  const safeName = escapeHtml(name || '');
  const safeTo = escapeHtml(to);
  const safeIdentifier = escapeHtml(loginIdentifier || to);
  const safePassword = escapeHtml(password);
  const isCode = codeLabel === 'code';
  const safeLabel = isCode ? 'Code' : 'Mot de passe';

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_FROM_NAME || safeApp,
          email: process.env.BREVO_FROM_EMAIL,
        },
        to: [{ email: to, name: name || undefined }],
        subject: `Vos identifiants de connexion — ${safeApp}`,
        htmlContent: `
          <p>Bonjour ${safeName},</p>
          <p>Un accès vient d'être créé (ou réinitialisé) pour vous sur <b>${safeApp}</b>.</p>
          <p>
            Identifiant de connexion : <b>${safeIdentifier}</b><br>
            ${safeLabel} temporaire : <b>${safePassword}</b>
          </p>
          <p>Nous vous recommandons de changer ce ${isCode ? 'code' : 'mot de passe'} après votre première connexion.</p>
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
