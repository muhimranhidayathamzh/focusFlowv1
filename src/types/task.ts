export interface TaskStep {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface Task {
  id: string;
  text: string;
  sourceDistractionId?: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  steps?: TaskStep[];
}

export interface FocusTarget {
  taskId: string;
  stepId?: string;
  label: string;
}
