import { ApiManager } from '../api/api-manager/ApiManager';
import { Api, IApiOptions } from '../api';
import { SchemaManager } from './';
import { Observable } from 'rxjs';

export class SchemaManagerApi {
    private _api: Api;
    private _options: IApiOptions;

    constructor(private _apiManager: ApiManager, private _sm: SchemaManager) {
        this._options = {
            name: 'schema-manager',
            useHttpHandler: true,
            useSocketHandler: true,
            // middleware: [_apiManager.middleware.isLoggedIn],
            routes: {
                get: {
                    allSchemas: {
                        route: '/schema-manager/',
                        handler: (body: any, params: any): Observable<object[]> => {
                            return Observable.of(_sm.schemasToObject(/./));
                        }
                    },
                    schema: {
                        route: '/schema-manager/:schema',
                        handler: (body: any, params: any): Observable<object> => {
                            try {
                                const obj: any = _sm.schemaToObject(params.schema);
                                return Observable.of(obj);
                            } catch (e) {
                                return Observable.throw(`Schema '${params.schema}' does not exist.`);
                            }

                        }
                    }
                }
            }
        };

        this._api = this._apiManager.createApi(this._options);
    }
}