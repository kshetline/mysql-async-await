import { FieldInfo, MysqlError, QueryFunction, QueryOptions } from 'mysql';

export const QM = { toSqlString: (): string => '?' };
export const DQM = { toSqlString: (): string => '??' };

export interface FullQueryResults {
  err: MysqlError | null;
  results: any;
  fields: FieldInfo[];
}

interface CanQuery {
  query: QueryFunction;
}

export interface ResultsWithFields {
  results: any;
  fields: FieldInfo[];
}

export abstract class Queryable {
  protected constructor(protected _queryable: CanQuery) {}

  query(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<FullQueryResults> {
    return new Promise<FullQueryResults>(resolve => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._queryable.query as any)(...args, (err: MysqlError, results: any, fields: FieldInfo[]) => {
        this.logError(err);
        resolve({err, results, fields});
      });
    });
  }

  queryResults(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._queryable.query as any)(...args, (err: MysqlError, results: any) => {
        if (err) {
          this.logError(err);
          reject(err);
        }
        else
          resolve(results);
      });
    });
  }

  queryResultsWithFields(sqlStringOrOptions: string | QueryOptions, values?: any): Promise<ResultsWithFields> {
    return new Promise<ResultsWithFields>((resolve, reject) => {
      const args = typeof sqlStringOrOptions === 'string' ?
        [sqlStringOrOptions, values] : [sqlStringOrOptions];

      (this._queryable.query as any)(...args, (err: MysqlError, results: any, fields: FieldInfo[]) => {
        if (err) {
          this.logError(err);
          reject(err);
        }
        else
          resolve({results, fields});
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected logError(err: MysqlError): void {}
}
