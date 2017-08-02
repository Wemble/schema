import { Validator } from './Validator';
import { ISchemaObject, ISchemaRegistry } from './';
import * as _ from 'lodash';
import { Observable } from 'rxjs';

export class SchemaManager {
    private _schemaRegistry: ISchemaRegistry = {};
    private _validator: Validator;

    public getSchema(name: string): ISchemaObject {
        if (!this._schemaRegistry.hasOwnProperty(name)) {
            throw new Error(`A schema with name ${name} isn't registered!`);
        }

        return this._schemaRegistry[name];
    }

    public registerSchema(schema: ISchemaObject, ignoreDuplicate: boolean = false): void {
        if (this._schemaRegistry.hasOwnProperty(schema.name) && !ignoreDuplicate) {
            throw new Error(`A schema with name ${schema.name} is already defined!`);
        }

        this._registerSchema(schema);
    }

    public schemasToObject(pattern: RegExp): Array<object> {
        return Object.keys(this._schemaRegistry).filter((key: string) => {
            return pattern.test(key);
        }).map((key: string) => {
            return this.schemaToObject(key);
        });
    }

    /**
     * Converts a registered schema to an object, useful for sending schemas over the wire.
     * This does not search the schema for deep schemas.
     * @param name the name of the schema to converrt
     */
    public schemaToObject(name: string): object {
        if (!this._schemaRegistry.hasOwnProperty(name)) {
            throw new Error(`A schema with name ${name} isn't registered!`);
        }

        const copy: any = _.cloneDeep(this._schemaRegistry[name]);

        Object.keys(copy.type).forEach((key: string) => {
            copy.type[key] = copy.type[key].name;
        });

        return copy;
    }

    public validateModel(schemaName: string,
        modelData: any, full: boolean = false): Observable<boolean> {

        return this.validator.validateModel(schemaName, modelData, full);
    }

    get validator(): Validator {
        if (!this._validator) {
            this._validator = new Validator(this);
        }

        return this._validator;
    }

    constructor() {
    }

    /**
     * This function doesn't throw when a schema is already registered, it just
     * quitely ignores it.
     * @param schema
     */
    private _registerSchema(schema: ISchemaObject): void {
        if (this._schemaRegistry.hasOwnProperty(schema.name)) {
            return;
        }

        this._schemaRegistry[schema.name] = schema;

        Object.keys(schema.type).forEach((key: string) => {
            if (typeof schema.type[key] === 'object') {
                // There are more sub schemas
                this._registerSchema(schema.type[key] as ISchemaObject);
            }
        });
    }
}
