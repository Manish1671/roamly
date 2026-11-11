import type { NormalizedDestination } from '@roamly/group-intelligence';

export interface DestinationCatalogProvider {
  readonly name: string;
  listDestinations(catalogVersion?: string): Promise<NormalizedDestination[]>;
  getById(id: string): Promise<NormalizedDestination | null>;
}
