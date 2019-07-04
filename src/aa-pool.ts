import mysql, { FieldInfo, MysqlError, PoolConnection, QueryOptions, Pool, PoolConfig, Connection } from 'mysql';
import { parse as parseUrl } from 'url';
import WriteStream = NodeJS.WriteStream;
import { AAConnection } from './aa-connection';
import { Queryable } from './queryable';

export interface FullQueryResults {
  err: MysqlError | null;
  results: any;
  fields: FieldInfo[];
}

export interface ResultsWithFields {
  results: any;
  fields: FieldInfo[];
}

export class AAPool extends Queryable {
  private _pool: Pool;
  private dbName: string;

  constructor(config: PoolConfig | string, private errorStream?: WriteStream) {
    super(mysql.createPool(config));
    this._pool = this._queryable as Pool;

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

      args = AAConnection.replaceConnectionArgs(args);
      callback(...args);
    });

    return this;
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

export class AAPoolConnection extends AAConnection {
  constructor(private _poolConnection: PoolConnection, private _pool: AAPool) {
    super(_poolConnection);
  }

  release(): void {
    this._poolConnection.release();
  }

  end(): Promise<void> {
    // PoolConnection end() method has no callback.
    this._poolConnection.end();
    return Promise.resolve();
  }
}
