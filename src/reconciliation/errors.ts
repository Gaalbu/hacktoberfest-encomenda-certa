export class DomainError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
  }
}
