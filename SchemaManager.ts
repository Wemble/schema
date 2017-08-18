import { ISchemaObjectJson, SchemaType } from './interfaces';
import { Validator } from './Validator';
import { ISchemaObject, ISchemaRegistry, } from './';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { generate, characters } from 'shortid';

// Sets characters for shortId, we don't want _ and - since it's confusing
characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@!');

export class SchemaManager {
    // This regex does not support multidimensional arrays
    public static readonly ARRAY_MAP_NOTATION: RegExp = /^(\w+)?(?:\[([0-9]+)\])?$/;

    private _schemaRegistry: ISchemaRegistry = {};
    private _validator: Validator;

    /**
     * Checks if a string 'path' is in the schema. Examples of a map/path are:
     * child[0], child[0].elem, random, [0].random
     *
     * Does not support multidimensional arrays.
     * @param schema
     * @param map
     */
    public static validateMap(schema: ISchemaObject, map: string): Observable<boolean> {
        const parts: string[] = map.split('.');

        let checkObj: any = schema;

        for (let p of parts) {
            const m: RegExpMatchArray = p.match(SchemaManager.ARRAY_MAP_NOTATION);

            if (!m) {
                return Observable.throw(`ValidateMap: Invalid map in ${map}, (${p}).`);
            }

            let [, variable, index]: any = m;

            if (typeof variable !== 'undefined') {
                if (!checkObj.type || !checkObj.type.hasOwnProperty(variable)) {
                    return Observable.throw(
                        `ValidateMap: Invalid map in ${map}, property ${variable} not found.`);
                }

                checkObj = checkObj.type[variable];
            }

            // If index defined, we are dealing with array notation (i.e. test[1])
            if (typeof index !== 'undefined') {
                if (!checkObj.isArray) {
                    return Observable.throw(`ValidateMap: Invalid map in ${map}, `
                        + `property ${variable} is not an array.`);
                }

                // Index does not actually advance the checkObj deeper.
            }
        }

        return Observable.of(true);
    }

    /**
     * Checks if a schema is resolved. If the resolved property is not present
     * it means the schema IS resolved. This is why we need an explicit false check.
     * @param schema
     */
    public static isSchemaResolved(schema: ISchemaObject): boolean {
        return schema.resolved !== false;
    }

    /**
     * Converts a json defined schema to an actual schema object. Json schemas don't have the name
     * property as requierd, if it is not present it will be automatically generatead.
     * Note: This does not register the schema.
     * @param obj
     * @param nameHint if the schema doesn't have a name defined this will be appeneded to the
     *                  randomly genereted ID that the schema gets.
     */
    public static schemaFromJson(obj: ISchemaObjectJson, nameHint?: string): ISchemaObject {
        const name: string = SchemaManager.generateSchemaName(obj, nameHint);

        const schema: ISchemaObject = {
            name: name,
            type: {}
        };

        if (typeof obj.isArray !== 'undefined') {
            schema.isArray = obj.isArray;
        }

        if (typeof obj.uniqueKey !== 'undefined') {
            schema.uniqueKey = obj.uniqueKey;
        }

        if (typeof obj.metaData !== 'undefined') {
            schema.metaData = obj.metaData;
        }

        if (typeof obj.type === 'undefined') {
            return schema;
        }

        Object.keys(obj.type).forEach((key: string) => {
            const val: any = obj.type[key];

            if (typeof val === 'string') {
                if (Validator.PRIMITIVES.indexOf(val) !== -1) {
                    // The string is either Number, String or Boolean. We simply set the type
                    // equal to the constructor of one of these types.
                    // Global.Number is just the Number type.

                    schema.type[key] = global[val];
                } else if (val === Validator.TYPE_ANY) {
                    schema.type[key] = Validator.TYPE_ANY;
                } else {
                    schema.type[key] = val;
                    schema.resolved = false;
                }
            } else if (typeof val === 'object') {
                schema.type[key] = SchemaManager.schemaFromJson(val);
            } else {
                throw new Error(
                    'All types in a json schema should be a string indicating the type.');
            }
        });


        return schema;
    }

    private static generateSchemaName(schema: ISchemaObject | ISchemaObjectJson,
        nameHint?: string): string {

        let name: string = schema.name;

        if (!name) {
            name = generate();

            if (nameHint) {
                name += '_' + nameHint;
            }
        }

        return name;
    }

    /**
     * Forces an object to adhere to the given schema
     * @param data
     * @param schema
     */
    public forceType(data: any = {}, schema: ISchemaObject): any {
        const newObj: any = {};

        Object.keys(data).forEach((key: string) => {
            const value: any = data[key];
            const type: SchemaType = schema.type[key];

            if (typeof type === 'function') {
                newObj[key] = type(value);
            } else if (typeof type === 'object') {
                newObj[key] = this.forceType(value, type);
            }
        });

        return newObj;
    }

    public getSchema(name: string): ISchemaObject {
        if (!this._schemaRegistry.hasOwnProperty(name)) {
            throw new Error(`A schema with name ${name} isn't registered!`);
        }

        return this._schemaRegistry[name];
    }

    public hasSchema(name: string): boolean {
        return this._schemaRegistry.hasOwnProperty(name);
    }

    /**
     * Registers a schema and all its child schemas.
     * @param schema
     * @param ignoreDuplicate
     */
    public registerSchema(schema: ISchemaObject,
        nameHint?: string,
        ignoreDuplicate: boolean = false): ISchemaObject {

        if (this._schemaRegistry.hasOwnProperty(schema.name) && !ignoreDuplicate) {
            throw new Error(`A schema with name ${schema.name} is already defined!`);
        }

        return this._registerSchema(schema, nameHint);
    }

    public registerSchemaFromJson(schema: ISchemaObjectJson,
        nameHint?: string,
        ignoreDuplicate: boolean = false): ISchemaObject {

        if (this._schemaRegistry.hasOwnProperty(schema.name) && !ignoreDuplicate) {
            throw new Error(`A schema with name ${schema.name} is already defined!`);
        }

        return this._registerSchema(SchemaManager.schemaFromJson(schema, nameHint));
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

    /**
     * Checks the current schema registry for unresolved schemas and resolves them
     * if possible. This should be called after registering all schemas.
     */
    public resolveAll(): boolean {
        const unresolvable: string[] = [];

        Object.keys(this._schemaRegistry).forEach((schemaName: string) => {
            const schema: ISchemaObject = this._schemaRegistry[schemaName];

            if (!SchemaManager.isSchemaResolved(schema)) {
                if (!this.resolveSchema(schema)) {
                    unresolvable.push(schemaName);
                }
            }
        });

        if (unresolvable.length) {
            const s: string = unresolvable.join(', ');
            throw new Error('Couldn\'t resolve the following schema(s): ' + s);
        }

        return true;
    }

    public resolveSchema(schema: ISchemaObject): boolean {
        if (SchemaManager.isSchemaResolved(schema)) {
            return true;
        }

        let isResolved: boolean = true;

        Object.keys(schema.type).forEach((key: string) => {
            const val: Function | ISchemaObject | string = schema.type[key];

            if (typeof val === 'string') {
                if (this._schemaRegistry[val]) {
                    // Unresolved string from a json reference
                    schema.type[key] = this._schemaRegistry[val];
                    return;
                }

                if (val === Validator.TYPE_ANY) {
                    // Any is always valid
                    return;
                }
            }

            if (typeof val === 'object') {
                return;
            }

            if (typeof val === 'function') {
                return;
            }

            isResolved = false;
        });

        schema.resolved = isResolved;
        return isResolved;
    }

    get registeredSchemas(): string[] {
        return Object.keys(this._schemaRegistry);
    }

    get validator(): Validator {
        if (!this._validator) {
            this._validator = new Validator(this);
        }

        return this._validator;
    }

    set validator(v: Validator) {
        if (v.schemaManager === this) {
            this._validator = v;
        }
    }

    constructor() {
    }

    /**
     * This function doesn't throw when a schema is already registered, it just
     * quitely ignores it.
     * @param schema
     */
    private _registerSchema(schema: ISchemaObject, nameHint?: string): ISchemaObject {
        schema.name = SchemaManager.generateSchemaName(schema, nameHint);

        if (this._schemaRegistry.hasOwnProperty(schema.name)) {
            return;
        }

        this._schemaRegistry[schema.name] = schema;

        Object.keys(schema.type).forEach((key: string) => {
            if (typeof schema.type[key] === 'object') {
                // There are more sub schemas
                this._registerSchema(schema.type[key] as ISchemaObject);
            } else if (typeof schema.type[key] === 'string') {
                // This can be resolved later

                if (schema.type[key] !== Validator.TYPE_ANY) {
                    schema.resolved = false;
                }
            } else if (typeof schema.type[key] === 'undefined') {
                throw new Error(`Type with key ${key} is undefined. If you need circular`
                    + ` references, you can use the name of the referenced schema as string.`);
            }
        });

        return schema;
    }
}
