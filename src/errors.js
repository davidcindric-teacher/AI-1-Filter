// Fel som ska visas för eleven med ett tydligt svenskt meddelande.
export class UserError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'UserError';
    this.details = details;
  }
}

export class TrainingCancelled extends Error {
  constructor() {
    super('Träningen avbröts.');
    this.name = 'TrainingCancelled';
  }
}
