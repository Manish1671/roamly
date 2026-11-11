import { Module } from '@nestjs/common';
import { TripsModule } from '../trips/trips.module';
import { CatalogSeedService } from './catalog-seed.service';
import { CuratedDestinationProvider } from './curated-destination.provider';
import { DestinationCatalogService } from './destination-catalog.service';
import { DestinationsController } from './destinations.controller';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { DestinationPollsController } from './destination-polls.controller';
import { DestinationPollsService } from './destination-polls.service';

@Module({
  imports: [TripsModule],
  controllers: [
    PreferencesController,
    DestinationsController,
    RecommendationsController,
    DestinationPollsController,
  ],
  providers: [
    PreferencesService,
    DestinationCatalogService,
    CuratedDestinationProvider,
    CatalogSeedService,
    RecommendationsService,
    DestinationPollsService,
  ],
})
export class GroupIntelligenceModule {}
