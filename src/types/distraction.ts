export type DistractionStatus =
  | 'inbox'
  | 'converted-to-task'
  | 'dismissed';

export interface DistractionItem {
  id: string;
  text: string;
  capturedAt: number;
  guardSessionId?: string;
  status: DistractionStatus;
  convertedTaskId?: string;
  resolvedAt?: number;
}

export interface AddDistractionInput {
  id?: string;
  text: string;
  guardSessionId?: string;
  capturedAt?: number;
}
