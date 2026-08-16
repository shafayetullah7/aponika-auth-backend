import { Inject, Injectable } from '@nestjs/common';
import { DrizzleClient, DrizzleTx } from './types';
import { DRIZZLE } from './types/drizzle.token';

@Injectable()
export class DrizzleService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleClient,
  ) {}

  get client() {
    return this.db;
  }

  async transaction<T>(callback: (tx: DrizzleTx) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
      return await callback(tx);
    });
  }

  getExecutor(tx?: DrizzleTx) {
    return tx ?? this.db;
  }
}
