import {
    ISchemaObject, ISchemaRegistry,
    customTypeValidator, ISchemaObjectJson,
    ISchemaTypeObject, SchemaType
} from './interfaces';
import { Validator } from './Validator';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import * as shortid from 'shortid';

// Sets characters for shortId, we don't want _ and - since it's confusing
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@!');

export class SchemaManager {
    // This regex does not support multidimensional arrays
    public static readonly ARRAY_MAP_NOTATION: RegExp = /^(\w+)?(?:\[([0-9]+)\])?$/;
    public customTypes: string[] = [];

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
        return schema._resolved !== false;
    }

    public registerType(typeName: string, typeValidator?: customTypeValidator): void {
        this.customTypes.push(typeName);

        this._validator.registerType(typeName, typeValidator);
    }

    /**
     * Converts a json defined schema to an actual schema object. Json schemas don't have the name
     * property as requierd, if it is not present it will be automatically generatead.
     * Note: This does not register the schema.
     * @param obj
     */
    public schemaFromJson(obj: ISchemaObjectJson | ISchemaObjectJson[] | string): ISchemaObject {
        const schema: ISchemaObject = {
            name: (<any>obj).name,
            type: {}
        };

        let typeHandler: any;

        if (Array.isArray(obj)) {
            if (obj.length !== 1) {
                throw new Error(`${schema.name}: using array shorthand but array is invalid.`);
            }

            schema.isArray = true;
            obj = obj[0];
        }

        if (typeof obj === 'object') {
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

            if (Array.isArray(obj.type)) {
                if (obj.isArray === false) {
                    throw new Error(`${schema.name}: type is array, but isArray is false.`);
                }

                return this.schemaFromJson(<ISchemaObjectJson[]>obj.type);
            } else {
                typeHandler = this.handleType(obj.type);
            }
        } else {
            // If the object is just a single string, it's also the type
            typeHandler = this.handleType(obj);
        }

        schema.type = typeHandler.type;

        if (typeof typeHandler._resolved !== 'undefined') {
            schema._resolved = typeHandler._resolved;
        }

        if (typeof typeHandler._singleType !== 'undefined') {
            schema._singleType = typeHandler._singleType;
        }

        return schema;
    }

    public handleType(type: object | string | Function):
        { type: any; _singleType: boolean; _resolved: boolean } {

        const obj: any = {
            type: {}
        };

        if (typeof type === 'string') {
            obj._singleType = true;

            const val: string = type;
            if (Validator.PRIMITIVES.indexOf(val) !== -1) {
                obj.type = global[val];
            } else if (this.customTypes.indexOf(val) !== -1) {
                obj.type = val;
            } else if (this._schemaRegistry.hasOwnProperty(val)) {
                obj.type = this._schemaRegistry[val];
            } else {
                obj.type = val;
                obj._resolved = false;
            }

            return obj;
        } else if (typeof type === 'function') {
            obj._singleType = true;
            obj.type = type;
            return obj;
        }

        Object.keys(type).forEach((key: string) => {
            const val: any = type[key];

            if (typeof val === 'string') {
                if (Validator.PRIMITIVES.indexOf(val) !== -1) {
                    // The string is either Number, String or Boolean. We simply set the type
                    // equal to the constructor of one of these types.
                    // Global.Number is just the Number type.

                    obj.type[key] = global[val];
                } else if (this.customTypes.indexOf(val) !== -1) {
                    obj.type[key] = val;
                } else if (this._schemaRegistry.hasOwnProperty(val)) {
                    obj.type[key] = this._schemaRegistry[val];
                } else {
                    obj.type[key] = val;
                    obj._resolved = false;
                }
            } else if (typeof val === 'object') {
                obj.type[key] = this.schemaFromJson(val);
            } else if (typeof val === 'function') {
                obj.type[key] = val;
            } else {
                throw new Error(
                    'All types in a json schema should be a string or function.');
            }
        });

        return obj;
    }

    /**
     * Forces an object to adhere to the given schema
     * @param data
     * @param schema
     */
    public forceType(data: any = {}, schema: ISchemaObject): any {
        let newObj: any = {};

        if (typeof data === 'object') {
            Object.keys(data).forEach((key: string) => {
                const value: any = data[key];
                const type: SchemaType = schema.type[key];

                if (typeof type === 'function') {
                    newObj[key] = type(value);
                } else if (typeof type === 'object') {
                    newObj[key] = this.forceType(value, type);
                }
            });
        } else {
            const type: SchemaType | { [k: string]: SchemaType } = schema.type;

            if (typeof type === 'function') {
                newObj = type(data);
            }
        }

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

        return this._registerSchema(schema, nameHint, ignoreDuplicate);
    }

    public registerSchemaFromJson(schema: ISchemaObjectJson | string,
        nameHint?: string,
        ignoreDuplicate: boolean = false): ISchemaObject {

        if (typeof schema !== 'string' &&
            this._schemaRegistry.hasOwnProperty(schema.name) && !ignoreDuplicate) {
            throw new Error(`A schema with name ${schema.name} is already defined!`);
        }

        return this._registerSchema(this.schemaFromJson(schema),
            nameHint, ignoreDuplicate);
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

        if (typeof copy.type !== 'string') {
            Object.keys(copy.type).forEach((key: string) => {
                copy.type[key] = copy.type[key].name;
            });
        }


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

        if (schema._singleType) {
            const val: SchemaType = <SchemaType>schema.type;

            if (typeof val === 'string') {
                if (this._schemaRegistry[val]) {
                    // Unresolved string from a json reference
                    schema.type = this._schemaRegistry[val];

                    return schema._resolved = true;
                }

                if (this.customTypes.indexOf(val) !== -1) {
                    return schema._resolved = true;
                }
            } else if (typeof val === 'object') {
                return schema._resolved = true;
            } else if (typeof val === 'function') {
                return schema._resolved = true;
            }

            isResolved = false;
        } else {
            Object.keys(schema.type).forEach((key: string) => {
                const val: SchemaType = schema.type[key];

                if (typeof val === 'string') {
                    if (this._schemaRegistry[val]) {
                        // Unresolved string from a json reference
                        schema.type[key] = this._schemaRegistry[val];
                        return;
                    }

                    if (this.customTypes.indexOf(val) !== -1) {
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
        }

        schema._resolved = isResolved;
        return isResolved;
    }

    get registeredSchemas(): string[] {
        return Object.keys(this._schemaRegistry);
    }

    get validator(): Validator {
        return this._validator;
    }

    set validator(v: Validator) {
        if (v.schemaManager === this) {
            this._validator = v;
        }
    }

    constructor() {
        this._validator = new Validator(this);

        this.registerType(Validator.TYPE_ANY);

        // Register the primitve type validators
        for (let p of Validator.PRIMITIVES) {
            const pLower: string = p.toLowerCase();

            this.registerType(p, (value: any): Observable<boolean> => {
                return Observable.of(typeof value === pLower);
            });
        }
    }

    private generateSchemaName(name: string, nameHint?: string,
        ignoreDuplicate: boolean = false): string {

        let duplicate: boolean = false;

        if (name && this._schemaRegistry.hasOwnProperty(name)) {
            if (!ignoreDuplicate) {
                throw new Error(`A schema with name ${name} is already defined!`);
            }

            duplicate = true;
        }

        if (name && duplicate) {
            return name + '_' + shortid.generate();
        } else if (name) {
            return name;
        } else {
            if (nameHint) {
                return this.generateSchemaName(nameHint, null, ignoreDuplicate);
            }

            return shortid.generate();
        }
    }


    /**
     * This function doesn't throw when a schema is already registered, it just
     * quitely ignores it.
     * @param schema
     */
    private _registerSchema(schema: ISchemaObject, nameHint?: string,
        ignoreDuplicate: boolean = false): ISchemaObject {

        if (ignoreDuplicate && this._schemaRegistry.hasOwnProperty(schema.name)) {
            return this._schemaRegistry[schema.name];
        }

        schema.name = this.generateSchemaName(schema.name, nameHint, ignoreDuplicate);

        this._schemaRegistry[schema.name] = schema;

        if (schema._singleType) {
            if (typeof schema.type === 'object') {
                // There are more sub schemas
                this._registerSchema(schema.type as ISchemaObject, null, true);
            } else if (typeof schema.type === 'string') {
                // This can be resolved later

                if (this.customTypes.indexOf(<string>schema.type) === -1) {
                    // It's only unresolved if a custom type isn't registered
                    schema._resolved = false;
                }
            }

            return schema;
        }

        Object.keys(schema.type).forEach((key: string) => {
            if (typeof schema.type[key] === 'object') {
                // There are more sub schemas
                this._registerSchema(schema.type[key] as ISchemaObject, null, true);
            } else if (typeof schema.type[key] === 'string') {
                // This can be resolved later

                if (this.customTypes.indexOf(<string>schema.type[key]) === -1) {
                    // It's only unresolved if a custom type isn't registered
                    schema._resolved = false;
                }
            } else if (typeof schema.type[key] === 'undefined') {
                throw new Error(`Type with key ${key} is undefined. If you need circular`
                    + ` references, you can use the name of the referenced schema as string.`);
            }
        });

        return schema;
    }
}
