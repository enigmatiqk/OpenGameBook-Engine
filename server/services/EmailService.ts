import nodemailer from 'nodemailer'
import type { config as AppConfig } from '../config'

export class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private degraded = false

  constructor(
    private readonly smtpConfig: (typeof AppConfig)['smtp'],
  ) {
    if (
      !smtpConfig.host ||
      !smtpConfig.user ||
      !smtpConfig.pass ||
      !smtpConfig.from
    ) {
      console.warn(
        '[EmailService] Configuration SMTP incomplète — mode dégradé activé',
      )
      this.degraded = true
      return
    }

    const secure = smtpConfig.secure
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure,
      auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    })
    console.log(`[EmailService] SMTP configuré — ${smtpConfig.host}:${smtpConfig.port} (${secure ? 'TLS' : 'STARTTLS'})`)
  }

  async sendMagicLink(
    to: string,
    pseudo: string,
    magicLink: string,
    token: string,
  ): Promise<void> {
    if (this.degraded || !this.transporter) {
      throw new Error('SMTP non configuré — envoi email impossible')
    }

    try {
      await this.transporter.sendMail({
        from: this.smtpConfig.from,
        to,
        subject: 'Votre lien de connexion OpenGameBook',
        text: `Bonjour ${pseudo},\n\nCliquez sur ce lien pour vous connecter :\n${magicLink}\n\nOu collez votre token directement dans le champ de connexion :\n${token}\n\nCe token est permanent — il reste valide jusqu'à ce que vous en demandiez un nouveau.`,
        html: `<p>Bonjour <strong>${pseudo}</strong>,</p>
               <p><a href="${magicLink}">Se connecter à OpenGameBook</a></p>
               <p>Ou collez votre token directement dans le champ de connexion :</p>
               <p><code style="font-family:monospace;font-size:0.85rem;word-break:break-all;background:#f4f4f4;padding:0.5rem;border-radius:4px;display:inline-block">${token}</code></p>
               <p style="font-size:0.8rem;color:#666">Ce token est permanent — il reste valide jusqu'à ce que vous en demandiez un nouveau.</p>`,
      })
      console.log(`[EmailService] Email envoyé à ${to}`)
    } catch (err) {
      console.error('[EmailService] Échec envoi email :', err)
      throw err
    }
  }
}
