import { expect } from 'chai';
import { AAConnection } from './aa-connection';
import { Types } from 'mysql';

describe('AAPoolConnection', () => {
  let connection: AAConnection;

  async function createConnection() {
    connection = AAConnection.createConnection({
      host: process.env.DB_TEST_HOST,
      user: process.env.DB_TEST_USER,
      password: process.env.DB_TEST_PWD,
      database: process.env.DB_TEST_DB
    });
    await connection.connect();
  }

  before(async () => {
    createConnection();
  });

  beforeEach(async () => {
    if (connection && connection.state === 'disconnected')
      createConnection();
  });

  after(async () => {
    try {
      await connection.end();
    }
    catch (err) {}
  });

  it('should be able to queries via queryResults()', async () => {
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

  it('should be able to perform queries via queryResultsWithFields()', async () => {
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

  it('should be able to perform queries via query()', async () => {
    const { err, results, fields } = await connection.query('SELECT 2 + 3 AS sum');
    expect(err).to.not.be.ok;
    expect(results[0].sum).equals(5);
    expect(fields[0].name).equals('sum');
    expect(fields[0].type).equals(Types.LONGLONG);

    try {
      const err2 = (await connection.query('SELECT * FROM non_existent_table')).err;
      expect(err2.toString()).to.be.contain('ER_NO_SUCH_TABLE');
    }
    catch (err) {
      expect(false).to.be.ok('exception should not have been thrown');
    }
  });

  it('should be able to change user', async() => {
    try {
      await connection.changeUser({ user: process.env.DB_TEST_USER2 });
      expect(true).to.be.ok;
      await connection.changeUser({ user: 'non_existent_user' });
    }
    catch (err) {
      expect(err && err.sqlMessage).to.match(/access denied.*non_existent_user/i);
    }
  });
});
