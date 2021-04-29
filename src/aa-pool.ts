import mysql, { MysqlError, PoolConnection, Pool, PoolConfig } from 'mysql';
import { parse as parseUrl } from 'url';
import WriteStream = NodeJS.WriteStream;
import { AAConnection } from './aa-connection';
import { Queryable } from './queryable';

export class AAPool extends Queryable {
  static createPool(config: PoolConfig | string, errorStream?: WriteStream): AAPool {
    return new AAPool(config, errorStream);
  }

  private readonly _pool: Pool;
  private readonly dbName: string;
  private connections = new Map<PoolConnection, AAPoolConnection>();

  constructor(config: PoolConfig | string, private errorStream?: WriteStream) {
    super(mysql.createPool(config));
    this._pool = this._queryable as Pool;

    if (typeof config === 'string')
      this.dbName = parseUrl(config).path;
    else
      this.dbName = config.database;
  }

  get pool(): Pool { return this._pool; }

  async getConnection(): Promise<AAPoolConnection> {
    return new Promise<AAPoolConnection>((resolve, reject) => {
      this._pool.getConnection((err, poolConnection) => {
        if (err) {
          this.logError(err);
          reject(err);
        }
        else {
          const aaPoolConnection = new AAPoolConnection(poolConnection);
          this.connections.set(poolConnection, aaPoolConnection);
          poolConnection.on('end', () => this.connections.delete(poolConnection));
          resolve(aaPoolConnection);
        }
      });
    });
  }

  async acquireConnection(connection: AAPoolConnection | PoolConnection): Promise<AAPoolConnection> {
    return new Promise<AAPoolConnection>((resolve, reject) => {
      this._pool.acquireConnection(connection instanceof AAPoolConnection ? connection.poolConnection : connection,
        (err: MysqlError, poolConnection: PoolConnection) => {
          if (err)
            reject(err);
          else if (this.connections.has(poolConnection))
            resolve(this.connections.get(poolConnection));
          else {
            const aaPoolConnection = new AAPoolConnection(poolConnection);
            this.connections.set(poolConnection, aaPoolConnection);
            resolve(aaPoolConnection);
          }
        });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  releaseConnection(connection: AAPoolConnection | PoolConnection): void {
    // this._pool.releaseConnection(connection instanceof AAPoolConnection ? connection.poolConnection : connection);
  }

  on(ev: 'acquire' | 'connection' | 'release', callback: (connection: AAPoolConnection) => void): AAPool;
  on(ev: 'error', callback: (err: MysqlError) => void): AAPool;
  on(ev: 'enqueue', callback: (err?: MysqlError) => void): AAPool;
  on(ev: string, callback: (...args: any[]) => void): AAPool {
    this._pool.on(ev, (...args: any[]) => {
      if (ev === 'error')
        this.logError(args[0]);

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

  protected logError(err: MysqlError): void {
    if (err && this.errorStream) {
      const name = this.dbName ? ` "${this.dbName}"` : '';
      this.errorStream.write(`Database${name} error: ${err.code}\n`);
    }
  }
}

export class AAPoolConnection extends AAConnection {
  constructor(private _poolConnection: PoolConnection) {
    super(_poolConnection);
  }

  get poolConnection(): PoolConnection { return this._poolConnection; }

  release(): void {
    this._poolConnection.release();
  }

  // For consistency with the superclass AAConnection this method returns a Promise, but
  // there's really nothing to wait for in this case. endNow() can be used instead.
  end(): Promise<void> {
    // PoolConnection end() method has no callback.
    this._poolConnection.end();
    return Promise.resolve();
  }

  endNow(): void {
    this._poolConnection.end();
  }
}
