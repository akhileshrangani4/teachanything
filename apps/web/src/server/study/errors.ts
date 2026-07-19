/** Error carrying an HTTP status for the study-response endpoints. */
export class StudyRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StudyRequestError";
  }
}
