import mysql, {
  Connection, ConnectionConfig, ConnectionOptions, MysqlError, QueryFunction, QueryOptions
} from 'mysql';
import WriteStream = NodeJS.WriteStream;
import { Queryable } from './queryable';
import { parse as parseUrl } from 'url';

export type ConnectionStates = 'connected' | 'authenticated' | 'disconnected' | 'protocol_error' | string;

const connections = new Map<Connection, AAConnection>();

export class AAConnection extends Queryable {
  static createConnection(connectionUri: string | ConnectionConfig, errorStream?: WriteStream): AAConnection {
    const connection = mysql.createConnection(connectionUri);
    const aaConnection = new AAConnection(connection, errorStream);

    if (typeof connectionUri === 'string')
      aaConnection.dbName = parseUrl(connectionUri).path;
    else
      aaConnection.dbName = connectionUri.database;

    return aaConnection;
  }

  static replaceConnectionArgs(args: any[]): any[] {
    if (args)
      return args.map(arg => connections.has(arg) ? connections.get(arg) : arg);
    else
      return args;
  }

  protected dbName: string;

  protected constructor(private _connection: Connection, private errorStream?: WriteStream) {
    super(_connection);
    connections.set(_connection, this);
    _connection.on('end', () => connections.delete(_connection));
  }

  get connection(): Connection { return this._connection; }

  get config(): ConnectionConfig { return this._connection.config; }

  get state(): ConnectionStates { return this._connection.state; }

  get threadId(): number | null { return this._connection.threadId; }

  /**
   * QueryFunction() argument options are as follows:
   *
   * (query: Query): Query;
   * (options: string | QueryOptions, callback?: queryCallback): Query;
   * (options: string, values: any, callback?: queryCallback): Query;
   */
  get createQuery(): QueryFunction { return this._connection.createQuery; }

  protected promisify<T>(method: Function, options: T, deleteConnection = false): Promise<any> {
    return new Promise<any>((resolve, reject): void => {
      const callback = (err: MysqlError, ...args: any[]): void => {
        if (err)
          reject(err);
        else
          resolve(args);

        if (deleteConnection)
          connections.delete(this._connection);
      };

      if (options)
        method.call(this._connection, options, callback);
      else
        method.call(this._connection, callback);
    });
  }

  async connect(options?: any): Promise<any> {
    return this.promisify(this._connection.connect, options);
  }

  async changeUser(options?: ConnectionOptions): Promise<any> {
    return this.promisify(this._connection.changeUser, options);
  }

  async beginTransaction(options?: QueryOptions): Promise<any> {
    return this.promisify(this._connection.beginTransaction, options);
  }

  async commit(options?: QueryOptions): Promise<any> {
    return this.promisify(this._connection.commit, options);
  }

  async rollback(options?: QueryOptions): Promise<any> {
    return this.promisify(this._connection.rollback, options);
  }

  async ping(options?: QueryOptions): Promise<any> {
    return this.promisify(this._connection.ping, options);
  }

  // TODO: Figure out how (and if) this is supposed to return any statistics.
  async statistics(options?: QueryOptions): Promise<any> {
    return this.promisify(this._connection.statistics, options);
  }

  /**
   * Close the connection. Any queued data (eg queries) will be sent first. If
   * there are any fatal errors, the connection will be immediately closed.r
   */
  async end(options?: any): Promise<any> {
    return this.promisify(this._connection.end, options, true);
  }

  /**
   * Close the connection immediately, without waiting for any queued data (eg
   * queries) to be sent. No further events or callbacks will be triggered.
   */
  destroy(): void {
    this._connection.destroy();
    connections.delete(this._connection);
  }

  /**
   * Pause the connection. No more 'result' events will fire until resume() is
   * called.
   */
  pause(): void {
    this._connection.pause();
  }

  /**
   * Resume the connection.
   */
  resume(): void {
    this._connection.resume();
  }

  on(ev: 'drain' | 'connect', callback: () => void): AAConnection;

  /**
   * Set handler to be run when the connection is closed.
   */
  on(ev: 'end', callback: (err?: MysqlError) => void): AAConnection;

  on(ev: 'fields', callback: (fields: any[]) => void): AAConnection;

  /**
   * Set handler to be run when a a fatal error occurs.
   */
  on(ev: 'error', callback: (err: MysqlError) => void): AAConnection;

  /**
   * Set handler to be run when a callback has been queued to wait for an
   * available connection.
   */
  // tslint:disable-next-line:unified-signatures
  on(ev: 'enqueue', callback: (err?: MysqlError) => void): AAConnection;

  /**
   * Set handler to be run on a certain event.
   */
  on(ev: string, callback: (...args: any[]) => void): AAConnection {
    this._connection.on(ev, (...args: any[]) => {
      if (ev === 'error')
        this.logError(args[0]);

      args = AAConnection.replaceConnectionArgs(args);
      callback(...args);
    });

    return this;
  }

  protected logError(err: MysqlError): void {
    if (err && this.errorStream) {
      const name = this.dbName ? ` "${this.dbName}"` : '';
      this.errorStream.write(`Database${name} error: ${err.code}\n`);
    }
  }
}
