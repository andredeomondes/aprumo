/**
 * Teto global de chamadas que consomem modelo de linguagem por dia (UTC).
 * O limite por IP não basta: muitos IPs juntos esgotariam a cota gratuita dos provedores.
 */
export class DailyBudget {
  private day = "";
  private used = 0;

  constructor(
    private readonly limit: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  usage(): { limit: number; used: number } {
    return { limit: this.limit, used: this.day === this.now().toISOString().slice(0, 10) ? this.used : 0 };
  }

  tryConsume(): boolean {
    const today = this.now().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
    if (this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }
}
