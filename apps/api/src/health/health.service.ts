import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  service: string;
  status: 'ok';
  timestamp: string;
}

@Injectable()
export class HealthService {
  getStatus(): HealthStatus {
    return {
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
