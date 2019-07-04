import { expect } from 'chai';
import { AAPool } from './aa-pool';
import { Types } from 'mysql';

describe('AAPool', () => {
  let pool: AAPool;

  before(() => {
    pool = new AAPool({
      host: process.env.DB_TEST_HOST,
      user: process.env.DB_TEST_USER,
      password: process.env.DB_TEST_PWD,
      database: process.env.DB_TEST_DB
    });
  });

  after(async () => {
    await pool.end();
  });

  it('should be able to get and release a MySQL AAPoolConnection', async () => {
    let acquired = false;
    let released = false;

    pool.on('acquire', () => acquired = true);
    pool.on('release', () => released = true);

    const connection = await pool.getConnection();

    expect(connection).to.be.ok;
    expect(acquired).to.be.ok;
    expect(released).to.not.be.ok;
    connection.release();
    expect(released).to.be.ok;
  });

  it('should be able to perform pool queries via queryResults()', async () => {
    const sum = (await pool.queryResults('SELECT 2 + 3 AS sum'))[0].sum;
    expect(sum).equals(5);

    try {
      await pool.queryResults('SELECT * FROM non_existent_table');
      expect(false).to.be.ok('exception should have been thrown');
    }
    catch (err) {
      expect(err.toString()).to.be.contain('ER_NO_SUCH_TABLE');
    }
  });

  it('should be able to perform pool queries via queryResultsWithFields()', async () => {
    const { results, fields } = await pool.queryResultsWithFields('SELECT 2 + 3 AS sum');
    expect(results[0].sum).equals(5);
    expect(fields[0].name).equals('sum');
    expect(fields[0].type).equals(Types.LONGLONG);

    try {
      await pool.queryResultsWithFields('SELECT * FROM non_existent_table');
      expect(false).to.be.ok('exception should have been thrown');
    }
    catch (err) {
      expect(err.toString()).to.be.contain('ER_NO_SUCH_TABLE');
    }
  });

  it('should be able to perform pool queries via query()', async () => {
    const { err, results, fields } = await pool.query('SELECT 2 + 3 AS sum');
    expect(err).to.not.be.ok;
    expect(results[0].sum).equals(5);
    expect(fields[0].name).equals('sum');
    expect(fields[0].type).equals(Types.LONGLONG);

    try {
      const { err } = await pool.query('SELECT * FROM non_existent_table');
      expect(err.toString()).to.be.contain('ER_NO_SUCH_TABLE');
    }
    catch (err) {
      expect(false).to.be.ok('exception should not have been thrown');
    }
  });
});
