export class NoopProgress {
  addTool(_toolName: string): void {}
  setStatus(_status: string): void {}
  dispose(): void {}
}
