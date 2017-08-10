import { ObjectID } from 'mongodb';
import { Observable } from 'rxjs';

/**
 * metaValue is the value in the metaData of the schema
 * key is the name of the key we are currently validating
 * value is the given value in the object we are validating
 * keyType is the type of the key in the Schema
 */
export type metaDataValidator = (metaValue: any, key: string, value: any, keyType: any) => Observable<boolean>;

export interface ISchemaRegistry {
    [key: string]: ISchemaObject;
}

export interface ISchemaObject {
    /**
     * The name of this object.
     */
    name: string;

    /**
     * Indicates what type this object is.
     * Function means a constructor of a class/type. Examples arE:
     * String | Boolean | Number
     */
    type: { [key: string]: Function | ISchemaObject };

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

export interface IModelData {
    [key: string]: any;
    _created?: Date;
    _modified?: Date;
    _id?: ObjectID | string;
}