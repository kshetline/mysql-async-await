import mysql, { MysqlError, PoolConfig, PoolConnection, Pool, PoolCluster, PoolClusterConfig } from 'mysql';
import WriteStream = NodeJS.WriteStream;
import { AAConnection } from './aa-connection';
import { AAPool } from './aa-pool';

type PoolConnectionCallback = (err: MysqlError, connection: PoolConnection) => void

export class AAPoolCluster {
  static createPool(config: PoolClusterConfig, errorStream?: WriteStream): AAPoolCluster {
    return new AAPoolCluster(config, errorStream);
  }

  private readonly _cluster: PoolCluster;
  private pools = new Map<Pool, AAPool>();

  private constructor(config: PoolClusterConfig, private errorStream?: WriteStream) {
    this._cluster = mysql.createPoolCluster(config);
  }

  get poolCluster(): PoolCluster { return this._cluster; }

  add(config: PoolConfig): void;
  add(id: string, config: PoolConfig): void;
  add(idOrConfig: string | PoolConfig, config?: PoolConfig): void {
    if (typeof idOrConfig === 'string')
      this._cluster.add(idOrConfig, config);
    else
      this._cluster.add(idOrConfig);
  }

  /**
   * Close the connection. Any queued data (eg queries) will be sent first. If
   * there are any fatal errors, the connection will be immediately closed.
   */
  end(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._cluster.end((err: MysqlError) => {
        if (err)
          reject(err);
        else
          resolve();
      });
    });
  }

  of(pattern: string, selector?: string): AAPool;
  of(pattern: undefined | null | false, selector: string): AAPool;
  of(pattern: string | undefined | null | false, selector?: string): AAPool {
    const pool = this._cluster.of(pattern as any, selector);
    console.log(pool);
    return null;
  }

  /**
   * remove all pools which match pattern
   */
  remove(pattern: string): void {
    this._cluster.remove(pattern);
  }

  getConnection(callback: PoolConnectionCallback): void;

  getConnection(pattern: string, callback: PoolConnectionCallback): void;

  getConnection(pattern: string, selector: string, callback: PoolConnectionCallback): void;

  getConnection(arg1: string | PoolConnectionCallback, arg2?: string | PoolConnectionCallback,
                arg3?: PoolConnectionCallback): void {
    let callback: PoolConnectionCallback;
    let selector: string;
    let pattern: string;

    if (arg3) {
      callback = arg3;
      selector = arg2 as string;
      pattern = arg1 as string;
    }
    else if (arg2) {
      callback = arg2 as PoolConnectionCallback;
      pattern = arg1 as string;
    }
    else
      callback = arg1 as PoolConnectionCallback;

    console.log(pattern, selector, callback);
  }

  /**
   * Set handler to be run on a certain event.
   */
  on(ev: string, callback: (...args: any[]) => void): AAPoolCluster;

  /**
   * Set handler to be run when a node is removed or goes offline.
   */
  on(ev: 'remove' | 'offline', callback: (nodeId: string) => void): AAPoolCluster;

  on(ev: string, callback: (...args: any[]) => void): AAPoolCluster {
    this._cluster.on(ev, (...args: any[]) => {
      if (ev === 'error')
        this.logError(args[0]);

      args = AAConnection.replaceConnectionArgs(args);
      callback(...args);
    });

    return this;
  }

  private logError(err: MysqlError): void {
    if (err && this.errorStream)
      this.errorStream.write(`Error: ${err.code}\n`);
  }
}
