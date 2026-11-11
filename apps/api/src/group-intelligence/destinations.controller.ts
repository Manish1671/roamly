import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { DestinationCatalogService } from './destination-catalog.service';

@Controller('destinations')
export class DestinationsController {
  constructor(private readonly catalog: DestinationCatalogService) {}

  @Get()
  list() {
    return this.catalog.list();
  }

  @Get(':destinationId')
  async getOne(@Param('destinationId') destinationId: string) {
    try {
      return await this.catalog.getById(destinationId);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException('Destination not found');
    }
  }
}
