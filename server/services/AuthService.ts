import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { DatabaseAdapter } from '../db/DatabaseAdapter'
import type { EmailService } from './EmailService'
import type { config as AppConfig } from '../config'
import { ConflictError, NotFoundError, UnauthorizedError } from '../types'

export class AuthService {
  constructor(
    private readonly db: DatabaseAdapter,
    private readonly emailService: EmailService,
    private readonly config: typeof AppConfig,
  ) {}

  async register(email: string, pseudo: string): Promise<void> {
    // 1. Vérifier les conflits avec les comptes activés
    const activatedEmail = this.db.get<{ id: string }>(
      'SELECT id FROM users WHERE email = ? AND activated = 1',
      [email],
    )
    if (activatedEmail) throw new ConflictError('email')

    const activatedPseudo = this.db.get<{ id: string }>(
      'SELECT id FROM users WHERE pseudo = ? AND activated = 1',
      [pseudo],
    )
    if (activatedPseudo) throw new ConflictError('pseudo')

    // 2. Supprimer les comptes non activés avec cet email ou ce pseudo
    this.db.run(
      'DELETE FROM users WHERE (email = ? OR pseudo = ?) AND activated = 0',
      [email, pseudo],
    )

    // 3. Générer le token (256 bits = 32 octets → 64 chars hex)
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')
    const id = crypto.randomUUID()

    // 4. Préparer l'envoi d'email AVANT d'écrire en base
    const magicLink = `${this.config.appBaseUrl}/api/auth/login?token=${token}`
    await this.emailService.sendMagicLink(email, pseudo, magicLink)

    // 5. Créer le compte seulement si l'email a réussi
    this.db.run(
      'INSERT INTO users (id, email, pseudo, token_hash) VALUES (?, ?, ?, ?)',
      [id, email, pseudo, tokenHash],
    )
  }

  login(token: string): string {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')
    const user = this.db.get<{ id: string; activated: number }>(
      'SELECT id, activated FROM users WHERE token_hash = ?',
      [tokenHash],
    )
    if (!user) throw new UnauthorizedError('Token invalide')

    // Marquer comme activé si première connexion
    if (!user.activated) {
      this.db.run('UPDATE users SET activated = 1 WHERE id = ?', [user.id])
    }

    // Retourner un JWT de session
    return jwt.sign({ userId: user.id }, this.config.jwtSecret, {
      expiresIn: '30d',
    })
  }

  async requestLogin(email: string): Promise<void> {
    const user = this.db.get<{ id: string; pseudo: string }>(
      'SELECT id, pseudo FROM users WHERE email = ?',
      [email],
    )
    if (!user) throw new NotFoundError('Aucun compte avec cet email')

    // Générer un nouveau token
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')
    this.db.run('UPDATE users SET token_hash = ? WHERE id = ?', [
      tokenHash,
      user.id,
    ])

    const magicLink = `${this.config.appBaseUrl}/api/auth/login?token=${token}`
    await this.emailService.sendMagicLink(email, user.pseudo, magicLink)
  }

  /**
   * Nettoyage des comptes non activés > 7 jours.
   * Appelé périodiquement par un setInterval dans server.ts.
   */
  cleanupExpiredAccounts(): void {
    this.db.run(
      `DELETE FROM users WHERE activated = 0
       AND created_at < datetime('now', '-7 days')`,
    )
  }
}
