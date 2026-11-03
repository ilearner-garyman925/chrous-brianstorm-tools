export class ChorusError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ChorusError";
    this.status = status;
  }
}
