import { ObjectID } from 'mongodb';
import { Observable } from 'rxjs';

/**
 * metaValue is the value in the metaData of the schema
 * key is the name of the key we are currently validating
 * value is the given value in the object we are validating
 * keyType is the type of the key in the Schema
 * meta is the full metadata object
 */
export type metaDataValidator =
    (metaValue: any, key: string, value: any, keyType: any, meta: any) => Observable<boolean>;

export type customTypeValidator =
    (value: any) => Observable<boolean>;

export interface ISchemaRegistry {
    [key: string]: ISchemaObject;
}

/**
 * Function means a constructor of a class/type. Possibilities are:
 * String | Boolean | Number
 *
 * When type is a string it indicates an unresolved reference to a different
 * SchemaObject.
 */
export type SchemaType = Function | ISchemaObject | string;

export interface ISchemaObject {
    /**
     * Indicates if this schema is fully resolved. Being resolved means that all
     * types are either Function or ISchemaObject and not string.
     *
     * An unresolved schema still has strings indicating references to other schemas.
     * When the resolved parameter is not present it means that the schema IS resolved
     * This means simply checking `if(obj.resolved)` won't have correct behaviour!
     */
    resolved?: boolean;

    /**
     * The name of this object. If a name is not set it will be randomly generated.
     */
    name?: string;

    /**
     * Indicates what type this object is.
     */
    type: { [key: string]: SchemaType };

    /**
     * Indicates if this object should be an array
     */
    isArray?: boolean;
    /**
     * 'uniqueKey' is used to identify the array element so it can be replaced, removed, etc.
     */
    uniqueKey?: string;

    /**
     * Anything that can be helpful to the frontend for displaying this information
     */
    metaData?: { [key: string]: any };
}

/**
 * This is how a schema can be saved on disk
 */
export interface ISchemaObjectJson {
    name?: string;

    type: { [key: string]: string | ISchemaObjectJson };

    isArray?: boolean;

    uniqueKey?: string;

    metaData?: { [key: string]: any };
}

export interface IModelData {
    [key: string]: any;
    _created?: Date;
    _modified?: Date;
    _id?: ObjectID | string;
}