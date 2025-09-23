export interface BehaviorAnalysis {
  userId: string;
  countsByType: Record<string, number>;
  lastActiveAt?: string;
}

