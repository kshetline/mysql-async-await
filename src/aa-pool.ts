import mysql, { FieldInfo, MysqlError, PoolConnection, QueryOptions, Pool, PoolConfig } from 'mysql';
import { parse as parseUrl } from 'url';
import WriteStream = NodeJS.WriteStream;

export interface FullQueryResults {
  err: MysqlError | null;
  results: any;
  fields: FieldInfo[];
}

export interface ResultsWithFields {
  results: any;
  fields: FieldInfo[];
}

export class AAPool {
  private _pool: Pool;
  private dbName: string;

  constructor(config: PoolConfig | string, private errorStream?: WriteStream) {
    this._pool = mysql.createPool(config);

    if (typeof config === 'string')
      this.dbName = parseUrl(config).path;
    else
      this.dbName = config.database;
  }

  get pool(): Pool { return this._pool; }

  getConnection(): Promise<AAPoolConnection> {
    return new Promise<AAPoolConnection>((resolve, reject) => {
      this._pool.getConnection((err, connection) => {
        if (err) {
          this._logError(err);
          reject(err);
        } else
          resolve(new AAPoolConnection(connection, this));
      });
    });
  }

  on(ev: 'acquire' | 'connection' | 'release', callback: (connection: AAPoolConnection) => void): AAPool;
  on(ev: 'error', callback: (err: MysqlError) => void): AAPool;
  on(ev: 'enqueue', callback: (err?: MysqlError) => void): AAPool;
  on(ev: string, callback: (...args: any[]) => void): AAPool {
    this._pool.on(ev, (...args: any[]) => {
      if (ev === 'error')
        this._logError(args[0]);

      if (args[0] && /^(acquire|connection|release)$/.test(ev))
        callback(new AAPoolConnection(args[0]));
      else
        callback(...args);
    });

    return this;
  }

  query(sqlStringOrOptions: string | QueryOptions, values?: any) {
    return new Promise<FullQueryResults>(resolve => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._pool.query as any)(...args, (err: MysqlError, results: any, fields: FieldInfo[]) => {
        this._logError(err);
        resolve({err, results, fields});
      });
    });
  }

  queryResults(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._pool.query as any)(...args, (err: MysqlError, results: any) => {
        if (err) {
          this._logError(err);
          reject(err);
        }
        else
          resolve(results);
      });
    });
  }

  queryResultsWithFields(sqlStringOrOptions: string | QueryOptions, values?: any) {
    return new Promise<ResultsWithFields>((resolve, reject) => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._pool.query as any)(...args, (err: MysqlError, results: any, fields: FieldInfo[]) => {
        if (err) {
          this._logError(err);
          reject(err);
        }
        else
          resolve({results, fields});
      });
    });
  }

  end(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._pool.end((err: MysqlError) => {
        if (err)
          reject(err);
        else
          resolve();
      });
    });
  }

  _logError(err: MysqlError): void {
    if (err && this.errorStream) {
      const name = this.dbName ? ` "${this.dbName}"` : '';

      if (err.code === 'PROTOCOL_CONNECTION_LOST')
        this.errorStream.write(`Database${name} connection was closed.\n`);
      else if (err.code === 'ER_CON_COUNT_ERROR')
        this.errorStream.write(`Database${name} has too many connections.\n`);
      else if (err.code === 'ECONNREFUSED')
        this.errorStream.write(`Database${name} connection was refused.\n`);
      else if (err.code === 'ENOTFOUND')
        this.errorStream.write(`Address ${(err as any).host} for database${name} not found.\n`);
      else
        this.errorStream.write(`Database${name} error: ${err.code}\n`);
    }
  }
}

export class AAPoolConnection {
  constructor(private _connection: PoolConnection, private parent?: AAPool) { }

  get connection(): PoolConnection { return this._connection; }

  query(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<FullQueryResults> {
    return new Promise<FullQueryResults>(resolve => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

        (this._connection.query as any)(...args, (err: MysqlError, results: any, fields: FieldInfo[]) => {
          this.logError(err);
          resolve({err, results, fields});
        });
    });
  }

  queryResults(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._connection.query as any)(...args, (err: MysqlError, results: any) => {
        if (err) {
          this.logError(err);
          reject(err);
        }
        else
          resolve(results);
      });
    });
  }

  queryResultsWithFields(sqlStringOrOptions: string | QueryOptions, values?: any) {
    return new Promise<ResultsWithFields>((resolve, reject) => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._connection.query as any)(...args, (err: MysqlError, results: any, fields: FieldInfo[]) => {
        if (err) {
          this.logError(err);
          reject(err);
        }
        else
          resolve({results, fields});
      });
    });
  }

  release(): void {
    this._connection.release();
  }

  private logError(err: MysqlError): void {
    if (err && this.parent)
      this.parent._logError(err);
  }
}
