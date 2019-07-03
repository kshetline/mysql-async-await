import { expect } from 'chai';
import { Pool, PoolConnection } from './pool';

describe('Pool', () => {
  let pool: Pool;

  beforeEach(() => {
    pool = new Pool({
      host: process.env.DB_TEST_HOST,
      user: process.env.DB_TEST_USER,
      password: process.env.DB_TEST_PWD,
      database: process.env.DB_TEST_DB
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
