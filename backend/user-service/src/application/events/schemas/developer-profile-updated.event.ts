export interface DeveloperProfileUpdatedEventData {
  userId: string;
  developerId: string;
  changedFields: string[];
  basicData: {
    companyName: string;
    companyType: string;
  };
  timestamp: string;
}

export class DeveloperProfileUpdatedEvent {
  constructor(public readonly data: DeveloperProfileUpdatedEventData) {}
}
