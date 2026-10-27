export class SingleFlight<T> {
  private pending?: Promise<T>;

  run(operation: () => Promise<T>): Promise<T> {
    if (this.pending) return this.pending;
    const pending = operation();
    this.pending = pending;
    void pending.then(
      () => {
        if (this.pending === pending) this.pending = undefined;
      },
      () => {
        if (this.pending === pending) this.pending = undefined;
      },
    );
    return pending;
  }
}
