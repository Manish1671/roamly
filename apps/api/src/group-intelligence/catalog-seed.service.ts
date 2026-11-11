import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CATALOG_VERSION, INDIA_CURATED_DESTINATIONS } from './catalog-seed-data';

@Injectable()
export class CatalogSeedService {
  private readonly logger = new Logger(CatalogSeedService.name);
  private seeding: Promise<number> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async ensureSeeded(): Promise<number> {
    if (!this.seeding) {
      this.seeding = this.seedCatalog();
    }
    return this.seeding;
  }

  async seedCatalog(): Promise<number> {
    let upserted = 0;
    for (const dest of INDIA_CURATED_DESTINATIONS) {
      await this.prisma.catalogDestination.upsert({
        where: { slug: dest.slug },
        create: {
          id: dest.id,
          slug: dest.slug,
          name: dest.name,
          countryCode: dest.countryCode,
          region: dest.region,
          description: dest.description,
          destinationTypes: dest.destinationTypes,
          interestTags: dest.interestTags,
          travelStyleTags: dest.travelStyleTags,
          climateProfile: dest.climateProfile,
          activityTags: dest.activityTags,
          budgetMin: new Prisma.Decimal(dest.budgetMin),
          budgetMax: new Prisma.Decimal(dest.budgetMax),
          budgetCurrency: dest.budgetCurrency,
          catalogVersion: CATALOG_VERSION,
          provenance: dest.provenance,
        },
        update: {
          name: dest.name,
          region: dest.region,
          description: dest.description,
          destinationTypes: dest.destinationTypes,
          interestTags: dest.interestTags,
          travelStyleTags: dest.travelStyleTags,
          climateProfile: dest.climateProfile,
          activityTags: dest.activityTags,
          budgetMin: new Prisma.Decimal(dest.budgetMin),
          budgetMax: new Prisma.Decimal(dest.budgetMax),
          budgetCurrency: dest.budgetCurrency,
          catalogVersion: CATALOG_VERSION,
          provenance: dest.provenance,
        },
      });
      upserted += 1;
    }
    this.logger.log(`Catalog seed: ${upserted} destinations (${CATALOG_VERSION})`);
    return upserted;
  }
}
