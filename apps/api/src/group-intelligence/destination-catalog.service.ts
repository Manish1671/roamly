import { Injectable, NotFoundException } from '@nestjs/common';
import type { DestinationSummary } from '@roamly/shared';
import { CuratedDestinationProvider } from './curated-destination.provider';

@Injectable()
export class DestinationCatalogService {
  constructor(private readonly curated: CuratedDestinationProvider) {}

  async list(): Promise<DestinationSummary[]> {
    const rows = await this.curated.listDestinations();
    return rows.map((d) => this.toSummary(d));
  }

  async getById(id: string): Promise<DestinationSummary> {
    const row = await this.curated.getById(id);
    if (!row) throw new NotFoundException('Destination not found');
    return this.toSummary(row);
  }

  private toSummary(d: Awaited<ReturnType<CuratedDestinationProvider['getById']>> & object) {
    if (!('budgetPerPerson' in d) || !d.budgetPerPerson) throw new Error('Invalid destination');
    return {
      id: d.id,
      slug: d.slug,
      name: d.name,
      countryCode: d.countryCode,
      region: d.region,
      description: d.description,
      destinationTypes: d.destinationTypes,
      interestTags: d.interestTags,
      climateProfile: d.climateProfile,
      budgetMin: String(d.budgetPerPerson.minPerPerson),
      budgetMax: String(d.budgetPerPerson.maxPerPerson),
      budgetCurrency: d.budgetPerPerson.currency,
      budgetIsEstimate: true as const,
      catalogVersion: d.catalogVersion,
      provenance: d.provenance,
    };
  }
}
