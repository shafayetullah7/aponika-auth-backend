import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';

@Injectable()
export class HealthService {
  constructor(private readonly drizzleService: DrizzleService) {}

  async checkDatabase(): Promise<'ok' | 'down'> {
    try {
      await this.drizzleService.client.execute(sql`SELECT 1`);
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
