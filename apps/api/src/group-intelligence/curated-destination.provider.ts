import { Injectable } from '@nestjs/common';
import type { NormalizedDestination } from '@roamly/group-intelligence';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CatalogSeedService } from './catalog-seed.service';
import type { DestinationCatalogProvider } from './destination-provider.types';

@Injectable()
export class CuratedDestinationProvider implements DestinationCatalogProvider {
  readonly name = 'curated-postgres';

  constructor(
    private readonly prisma: PrismaService,
    private readonly seed: CatalogSeedService,
  ) {}

  async listDestinations(catalogVersion?: string): Promise<NormalizedDestination[]> {
    await this.seed.ensureSeeded();
    const rows = await this.prisma.catalogDestination.findMany({
      where: catalogVersion ? { catalogVersion } : undefined,
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toNormalized(row));
  }

  async getById(id: string): Promise<NormalizedDestination | null> {
    await this.seed.ensureSeeded();
    const row = await this.prisma.catalogDestination.findUnique({ where: { id } });
    return row ? this.toNormalized(row) : null;
  }

  private toNormalized(row: {
    id: string;
    slug: string;
    name: string;
    countryCode: string;
    region: string;
    description: string;
    destinationTypes: string[];
    interestTags: string[];
    travelStyleTags: string[];
    climateProfile: string;
    activityTags: string[];
    budgetMin: Prisma.Decimal;
    budgetMax: Prisma.Decimal;
    budgetCurrency: string;
    catalogVersion: string;
    provenance: string;
  }): NormalizedDestination {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      countryCode: row.countryCode,
      region: row.region,
      description: row.description,
      destinationTypes: row.destinationTypes as NormalizedDestination['destinationTypes'],
      interestTags: row.interestTags as NormalizedDestination['interestTags'],
      travelStyleTags: row.travelStyleTags as NormalizedDestination['travelStyleTags'],
      climateProfile: row.climateProfile as NormalizedDestination['climateProfile'],
      activityTags: row.activityTags,
      budgetPerPerson: {
        minPerPerson: row.budgetMin.toNumber(),
        maxPerPerson: row.budgetMax.toNumber(),
        currency: row.budgetCurrency,
        isEstimate: true,
      },
      catalogVersion: row.catalogVersion,
      provenance: row.provenance,
    };
  }
}
