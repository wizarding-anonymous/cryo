export interface PublisherProfileUpdatedEventData {
  userId: string;
  publisherId: string;
  changedFields: string[];
  basicData: {
    companyName: string;
    companyType: string;
  };
  timestamp: string;
}

export class PublisherProfileUpdatedEvent {
  constructor(public readonly data: PublisherProfileUpdatedEventData) {}
}
