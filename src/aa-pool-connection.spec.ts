import { expect } from 'chai';
import { AAPool, AAPoolConnection } from './aa-pool';
import { Types } from 'mysql';

describe('AAPoolConnection', () => {
  let pool: AAPool;
  let connection: AAPoolConnection;

  before(async () => {
    pool = new AAPool({
      host: process.env.DB_TEST_HOST,
      user: process.env.DB_TEST_USER,
      password: process.env.DB_TEST_PWD,
      database: process.env.DB_TEST_DB
    });
    connection = await pool.getConnection();
  });

  after(async () => {
    connection.release();
    await pool.end();
  });

  it('should be able to perform pool queries via queryResults()', async () => {
    const sum = (await connection.queryResults('SELECT 2 + 3 AS sum'))[0].sum;
    expect(sum).equals(5);

    try {
      await connection.queryResults('SELECT * FROM non_existent_table');
      expect(false).to.be.ok('exception should have been thrown');
    }
    catch (err) {
      expect(err.toString()).to.be.contain('ER_NO_SUCH_TABLE');
    }
  });

  it('should be able to perform pool queries via queryResultsWithFields()', async () => {
    const { results, fields } = await connection.queryResultsWithFields('SELECT 2 + 3 AS sum');
    expect(results[0].sum).equals(5);
    expect(fields[0].name).equals('sum');
    expect(fields[0].type).equals(Types.LONGLONG);

    try {
      await connection.queryResultsWithFields('SELECT * FROM non_existent_table');
      expect(false).to.be.ok('exception should have been thrown');
    }
    catch (err) {
      expect(err.toString()).to.be.contain('ER_NO_SUCH_TABLE');
    }
  });

  it('should be able to perform pool queries via query()', async () => {
    const { err, results, fields } = await connection.query('SELECT 2 + 3 AS sum');
    expect(err).to.not.be.ok;
    expect(results[0].sum).equals(5);
    expect(fields[0].name).equals('sum');
    expect(fields[0].type).equals(Types.LONGLONG);

    try {
      const { err } = await connection.query('SELECT * FROM non_existent_table');
      expect(err.toString()).to.be.contain('ER_NO_SUCH_TABLE');
    }
    catch (err) {
      expect(false).to.be.ok('exception should not have been thrown');
    }
  });
});
