// Types partagés côté backend

export class ConflictError extends Error {
  constructor(
    public readonly field: 'email' | 'pseudo',
    message?: string,
  ) {
    super(message ?? `Conflit sur le champ ${field}`)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
