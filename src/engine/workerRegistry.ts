let workerRef: { pauseStrategy?: (id: number) => Promise<void> | void; [key: string]: unknown } | null = null;

export function setWorkerInstance(worker: any): void {
  workerRef = worker;
}

export function getWorkerInstance() {
  return workerRef;
}
