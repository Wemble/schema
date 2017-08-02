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