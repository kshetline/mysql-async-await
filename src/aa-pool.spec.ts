import { expect } from 'chai';
import { AAPool, AAPoolConnection } from './aa-pool';

describe('AAPool', () => {
  let pool: AAPool;

  beforeEach(() => {
    pool = new AAPool({
      host: process.env.DB_TEST_HOST,
      user: process.env.DB_TEST_USER,
      password: process.env.DB_TEST_PWD,
      database: process.env.DB_TEST_DB
    });
  });

  afterEach(async () => {
    await pool.end();
  });

  it('should be able to get and release a MySQL AAPoolConnection', async () => {
    const connection = await pool.getConnection();

    expect(connection).to.be.ok;
    connection.release();
  });
});
