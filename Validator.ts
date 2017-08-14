import { ISchemaObject, ISchemaRegistry, SchemaManager, metaDataValidator } from './';
import { Observable } from 'rxjs';

export class Validator {
    public static readonly PRIMITIVES: string[] = ['String',
        'Boolean', 'Number'];

    public static readonly WHITELISTED_KEYS: string[] = ['_id',
        '_isScalar', '_created', '_modified'];

    public static readonly TYPE_ANY: string = 'Any';

    private _metaValidator: {
        [key: string]: metaDataValidator;
    } = {};

    constructor(private _schemaManager: SchemaManager) {
        _schemaManager.validator = this;
    }

    get schemaManager(): SchemaManager {
        return this._schemaManager;
    }

    public setMetaDataValidator(metaKey: string, f: metaDataValidator): void {
        this._metaValidator[metaKey] = f;
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
            return Observable.throw(`${schema.name}: ${e}`);
        }

        if (!SchemaManager.isSchemaResolved(schema)) {
            return Observable.throw(`Schema ${schemaName} is unresolved and cannot be validated.`);
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
        const keys: string[] = full ? Object.keys(schema.type)
            : Object.keys(modelData);

        if (!keys.length) {
            return Observable.throw(`${schema.name}: No key/values present in model.`);
        }

        // Check if there are keys in the model that are not in de schema
        // This is only necessary when full is true, since we then loop over the keys
        // in the schema instead of in the object.
        if (full) {
            const k: string = Object.keys(modelData).find((k: string) => {
                return !schema.type.hasOwnProperty(k)
                    && Validator.WHITELISTED_KEYS.indexOf(k) === -1;
            });

            if (k) {
                return Observable.throw(`${schema.name}: Given key ${k} not defined in schema.`);
            }
        }

        return Observable.from(keys)
            .flatMap((key: string) => {
                if (full && !modelData.hasOwnProperty(key)
                    && this.isKeyRequired(schema, key)) {
                    return Observable.throw(`${schema.name}: key ${key} is required.`);
                }

                const value: any = modelData[key];
                return this.validateValue(schema, key, value, full);
            });
    }

    private validateMetaData(schema: ISchemaObject, key: string, value: any, type: string): Observable<boolean> {
        const metaData: any = schema.metaData;

        if (!metaData) {
            // There is no metaData so this key, value pair is valid
            return Observable.of(true);
        }

        const keyData: any = metaData[key];

        if (!keyData) {
            // This key has no metaData
            return Observable.of(true);
        }

        const keyArray: string[] = Object.keys(keyData);

        if (!keyArray.length) {
            // keyData is an empty object
            return Observable.of(true);
        }

        return Observable.from(keyArray)
            .flatMap((metaKey: string) => {
                if (!this._metaValidator.hasOwnProperty(metaKey)) {
                    // We don't know how to handle this type of metadata.
                    return Observable.of(true);
                }

                return this._metaValidator[metaKey]
                    (keyData[metaKey], key, value, type, keyData);
            })
            .every((b: boolean) => b);
    }

    private validateValue(schema: ISchemaObject,
        key: string, value: any, full: boolean): Observable<boolean> {
        // These keys are always allowed
        if (Validator.WHITELISTED_KEYS.indexOf(key) !== -1) {
            return Observable.of(true);
        }

        if (typeof schema.type[key] === 'undefined') {
            return Observable.throw(`${schema.name}: Given key ${key} not defined in schema.`);
        }

        if (schema.type[key] === Validator.TYPE_ANY) {
            // This object can be anything
            return this.validateMetaData(schema, key, value, Validator.TYPE_ANY);
        }

        const type: string = this.getSchemaKeyType(schema, key);

        if (Validator.PRIMITIVES.indexOf(type) !== -1) {
            const valueType: string = typeof value;
            // We are dealing with a primitive type
            if (valueType === type.toLowerCase()) {
                return this.validateMetaData(schema, key, value, type);
            } else if (valueType === 'undefined') {
                if (full && this.isKeyRequired(schema, key)) {
                    return Observable.throw(`${schema.name}: Key ${key} is`
                        + ` not defined, but this key is required.`);
                } else {
                    // Not doing a full check so it's fine
                    return Observable.of(true);
                }
            } else {
                return Observable.throw(`${schema.name}: Key ${key} is`
                    + ` of type ${valueType} but should be ${type.toLowerCase()}`);
            }
        }

        // Else, this object is another schema
        return this.validateModel(type, value, full)
            .every((b: boolean) => b)
            .flatMapTo(this.validateMetaData(schema, key, value, type));
    }

    private getSchemaKeyType(schema: ISchemaObject, key: string): string {
        // This is either a function name or a ISchemaObject name
        if (typeof schema.type[key] === 'string') {
            throw new Error(`${schema.name}: Key ${key} is unresolved!`);
        }

        // We cast to any here since we know for certain the object contains the name property,
        // since it's either a Function or ISchemaObject. But typescript will complain.
        return (schema.type[key] as any).name;
    }

    private isKeyRequired(schema: ISchemaObject, key: string): boolean {
        return schema.metaData
            && schema.metaData.hasOwnProperty(key)
            && schema.metaData[key].required;
    }

}