import { expect } from 'chai';
import { Pool, PoolConnection } from './pool';

const password = 'nOtSoS3Cr3t!';

describe('Pool', () => {
  let pool: Pool;

  beforeEach(() => {
    pool = new Pool({
      host: 'shetline.com',
      user: 'guest',
      password,
      database: 'test'
    });
  });

  afterEach(async () => {
    await pool.end();
  });

  it('should be able to get and release a MySQL PoolConnection', async () => {
    const connection = await pool.getConnection();

    expect(connection).to.be.ok;
    connection.release();
  });
});
