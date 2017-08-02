import { Schema } from './Schema';
import { ISchemaObject, ISchemaRegistry, SchemaManager } from './';
import { Observable } from 'rxjs';

export class Validator {
    private static readonly WHITELISTED_KEYS: string[] = ['_id',
        '_isScalar', '_created', '_modified'];

    private static readonly PRIMITIVES: string[] = ['String',
        'Boolean', 'Number'];

    constructor(private _schemaManager: SchemaManager) {

    }

    /**
     * Check whether all fields of the modelData are proper fields for this schema..
     * Note: it is allowed to leave out fields from the modelData that are present in the schema.
     * @param schemaName the name of the schema to base the check on
     * @param modelData the object to check
     * @param full a flag indicating if the modelData should be a full object (i.e. true is used for create
     *          while false is used for update)
     * @returns 0 to n booleans indicating if the present keys have the proper data type attached
     *          to them.
     *
     *          It throws when a key isn't valid, or when there are no keys present.
     */
    public validateModel(schemaName: string,
        modelData: any, full: boolean = false): Observable<boolean> {

        let schema: ISchemaObject;

        try {
            schema = this._schemaManager.getSchema(schemaName);
        } catch (e) {
            return Observable.throw(e);
        }

        if (schema.isArray && Array.isArray(modelData)) {
            return this.validateArray(schema, modelData, full);
        } else if (schema.isArray && !Array.isArray(modelData)) {
            return Observable.throw(`${schemaName} object should be an array.`);
        } else if (!schema.isArray && Array.isArray(modelData)) {
            return Observable.throw(`${schemaName} should not be an array.`);
        }

        // They are both not arrays
        return this.validateItem(schema, modelData, full);
    }

    private validateArray(schema: ISchemaObject, modelData: Array<any>,
        full: boolean): Observable<boolean> {

        if (!modelData.length) {
            // Empty array is allowed
            return Observable.of(true);
        }

        return Observable.from(modelData)
            .flatMap((dataItem: any) => {
                return this.validateItem(schema, dataItem, full);
            });
    }

    private validateItem(schema: ISchemaObject, modelData: any, full: boolean): Observable<boolean> {
        // const keys: string[] = Object.keys(modelData);

        const keys: string[] = full ? Object.keys(schema.type)
            : Object.keys(modelData);

        if (!keys.length) {
            return Observable.throw('No key/values present in model.');
        }

        return Observable.from(keys)
            .flatMap((key: string) => {
                if (full && !modelData.hasOwnProperty(key)
                    && this.isKeyRequired(schema, key)) {
                    return Observable.throw(`Key ${key} is required in ${schema.name}.`);
                }

                const value: any = modelData[key];
                return this.validateValue(schema, key, value, full);
            });
    }

    private validateValue(schema: ISchemaObject,
        key: string, value: any, full: boolean): Observable<boolean> {
        // These keys are always allowed
        if (Validator.WHITELISTED_KEYS.indexOf(key) !== -1) {
            return Observable.of(true);
        }

        const type: string = this.getSchemaKeyType(schema, key);

        if (Validator.PRIMITIVES.indexOf(type) !== -1) {
            const valueType: string = typeof value;
            // We are dealing with a primitive type
            if (valueType === type.toLowerCase()) {
                return Observable.of(true);
            } else if (valueType === 'undefined') {
                if (full && this.isKeyRequired(schema, key)) {
                    return Observable.throw(`Key ${key} in ${schema.name} is`
                        + ` not defined, but this key is required.`);
                } else {
                    // Not doing a full check so it's fine
                    return Observable.of(true);
                }
            } else {
                return Observable.throw(`Key ${key} in ${schema.name} is`
                    + ` of type ${valueType} but should be ${type.toLowerCase()}`);
            }
        }

        // Else, this object is another schema
        return this.validateModel(type, value, full);
    }

    private getSchemaKeyType(schema: ISchemaObject, key: string): string {
        // This is either a function name or a ISchemaObject name
        return schema.type[key].name;
    }

    private isKeyRequired(schema: ISchemaObject, key: string): boolean {
        return schema.metaData
            && schema.metaData.hasOwnProperty(key)
            && schema.metaData[key].required;
    }

}