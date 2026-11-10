import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp
      ? exception.getResponse()
      : { message: 'Internal server error', statusCode: status };

    if (!isHttp) {
      this.logger.error(exception);
    }

    response.status(status).json(
      typeof message === 'string'
        ? { statusCode: status, message, timestamp: new Date().toISOString() }
        : { ...message, timestamp: new Date().toISOString() },
    );
  }
}
