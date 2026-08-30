export class CtmType<T> {
  constructor(
    private code: T,
    private forHumans: string,
    private abbreviation?: string
  ) {}

  public getCode(): T {
    return this.code;
  }

  public getForHumans(): string {
    return this.forHumans;
  }

  public getAbbreviation(): string {
    return this.abbreviation;
  }
}

export const DEFAULT_TYPE = new CtmType(-999, 'CODIGO NO VALIDO', 'CNV') as any;
