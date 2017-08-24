import 'mocha';
import { assert, expect } from 'chai';
import { Observable } from 'rxjs';
import { inspect } from 'util';
import { ISchemaObject, SchemaManager, Validator } from '../src';

const sm: SchemaManager = new SchemaManager();
const validator: Validator = sm.validator;

const worm: ISchemaObject = {
    name: 'worm',
    isArray: true,
    uniqueKey: 'hashCode',
    type: {
        alive: Boolean,
        wormAge: String,
        length: Number,
        hashCode: String
    },

    metaData: {
        alive: {
            required: true
        }
    }
};

const leave: ISchemaObject = {
    name: 'leave',
    uniqueKey: 'hashCode',
    isArray: true,
    type: {
        age: Number,
        count: Number,
        worms: worm,
        hashCode: String // Totally unique identifier
    },

    metaData: {
        age: {
            required: true
        },
        count: {
            required: true
        },
        worms: {
            required: true
        },
        hashCode: {
            required: true
        }
    }
};

const tree: ISchemaObject = {
    name: 'tree',
    type: {
        treeAge: Number,
        leaves: leave
    },

    metaData: {
        leaves: {
            required: true,
            minAmount: 2
        }
    }
};

const simple: ISchemaObject = {
    name: 'simple',
    type: {
        count: Number
    },

    metaData: {
        count: {
            required: true,
            minCount: 10
        }
    }
};

const anything: ISchemaObject = {
    name: 'anything',
    type: {
        something: Boolean,
        obj: 'Any'
    },

    metaData: {
        something: {
            required: true
        },
        obj: {
            required: true
        }
    }
};

describe('Schema', function (): void {
    it('Should register new schemas', function (done: MochaDone): void {
        sm.registerSchema(tree);
        sm.registerSchema(simple);
        sm.registerSchema(anything);

        try {
            sm.getSchema('tree');
            sm.getSchema('leave');
            sm.getSchema('worm');

            sm.getSchema('simple');

            done();
        } catch (e) {
            done(e);
        }
    });

    it('Should validate a modelData object', function (done: MochaDone): void {
        const o: any = {
            treeAge: 10,
            leaves: [
                {
                    age: 3,
                    count: 10,
                    worms: [{
                        hashCode: 'ads'
                    }],
                    hashCode: 'unique'
                }
            ]
        };

        validator.validateModel('tree', o)
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should not validate a modelData object', function (done: MochaDone): void {
        const o: any = {
            treeAge: 10,
            leaves: [
                {
                    age: 3,
                    count: 10,
                    worms: [{
                        alive: 'nee'
                    }],
                    hashCode: 'unique'
                }
            ]
        };

        validator.validateModel('tree', o)
            .every((b: boolean) => b)
            .subscribe(() => {
                done('Validated incorrect object');
            }, (err: any) => {
                done();
            });
    });

    it('Should validate a modelData object fully', function (done: MochaDone): void {
        const o: any = {
            treeAge: 10,
            leaves: [
                {
                    age: 3,
                    count: 10,
                    worms: [{
                        alive: true
                    }],
                    hashCode: 'unique'
                }
            ]
        };

        validator.validateModel('tree', o, true)
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should not validate a modelData object fully', function (done: MochaDone): void {
        const o: any = {
            treeAge: 10,
            leaves: [
                {
                    age: 3,
                    count: 10,
                    worms: [{
                        length: 10
                    }],
                    hashCode: 'unique'
                }
            ]
        };

        validator.validateModel('tree', o, true)
            .every((b: boolean) => b)
            .subscribe(() => {
                done('Validated the object anyway.');
            }, (err: any) => {
                done();
            });
    });

    it('Shouldn\'t validate because of metaData', function (done: MochaDone): void {
        const o: any = {
            count: 9
        };

        validator.setMetaDataValidator('minCount',
            (minAmount: any, key: string, value: any, type: any): Observable<boolean> => {
                if (value >= minAmount) {
                    return Observable.of(true);
                }

                return Observable.throw(
                    `Key '${key}' doesn't have the minimum amount of ${minAmount}`);
            });

        validator.validateModel('simple', o)
            .every((b: boolean) => b)
            .subscribe(() => {
                done('Validated the object anyway.');
            }, (err: any) => {
                done();
            });
    });


    it('MetaData check on an array should pass', function (done: MochaDone): void {
        const o: any = {
            treeAge: 10,
            leaves: [
                {
                    age: 3,
                    count: 10,
                    worms: [{
                        hashCode: 'ads'
                    }],
                    hashCode: 'unique'
                },
                {
                    age: 5,
                    count: 2,
                    worms: [{
                        hashCode: 'ads2'
                    }],
                    hashCode: 'unique2'
                }
            ]
        };

        validator.setMetaDataValidator('minAmount',
            (minAmount: any, key: string, value: any, type: any): Observable<boolean> => {
                if (value.length >= minAmount) {
                    return Observable.of(true);
                }

                return Observable.throw(
                    `Key '${key}' doesn't have the minimum amount of ${minAmount}`);
            });

        validator.validateModel('tree', o)
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should create a schema from json', function (done: MochaDone): void {
        const json: any = {
            name: 'Component1Schema',
            type: {
                test1: 'Boolean',
                test2: 'String',
            },
            metaData: {
                alive: {
                    required: true
                }
            }
        };

        const schema: ISchemaObject = sm.schemaFromJson(json);
        assert.equal(SchemaManager.isSchemaResolved(schema), true, 'Schema is not resolved');
        assert.equal((<any>schema.type).test1, Boolean);
        assert.equal((<any>schema.type).test2, String);

        done();
    });

    it('Should create a schema from json that is unresolved', function (done: MochaDone): void {
        const json: any = {
            name: 'Component1Schema',
            type: {
                test1: 'Boolean',
                child: 'Component2Schema'
            },
            metaData: {
                alive: {
                    required: true
                }
            }
        };

        const schema: ISchemaObject = sm.schemaFromJson(json);
        assert.equal(SchemaManager.isSchemaResolved(schema), false, 'Schema is resolved');
        assert.equal((<any>schema.type).test1, Boolean);

        sm.registerSchema(schema);

        done();
    });

    it('Should create a schema that resolves the last schema', function (done: MochaDone): void {
        const schema: ISchemaObject = {
            name: 'Component2Schema',
            type: {
                item: String
            }
        };

        sm.registerSchema(schema);
        sm.resolveAll();

        assert.equal((<any>sm.getSchema('Component1Schema').type).child, schema);

        done();
    });

    it('Should create a schema that references itself', function (done: MochaDone): void {
        const top: ISchemaObject = {
            name: 'circle',
            type: {}
        };

        (<any>top.type).ref = top;

        sm.registerSchema(top);

        const s: ISchemaObject = sm.getSchema('circle');
        assert.equal((<any>s.type).ref, s);

        done();
    });

    it('Should resolve schemas with circular reference', function (done: MochaDone): void {
        const a: ISchemaObject = {
            name: 'a',
            type: {
                ref: 'b'
            }
        };

        const b: ISchemaObject = {
            name: 'b',
            type: {
                ref: a
            }
        };

        sm.registerSchema(a);
        sm.registerSchema(b);

        sm.resolveAll();

        assert.include(sm.registeredSchemas, 'a');
        assert.include(sm.registeredSchemas, 'b');

        done();
    });

    it('Should validate a modelData with \'any\' type.', function (done: MochaDone): void {
        const o: any = {
            something: true,
            obj: {
                whatever: true,
                deep: {
                    x: 1
                }
            }
        };

        validator.validateModel('anything', o, true)
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should not validate a modelData data not in schema.', function (done: MochaDone): void {
        const o: any = {
            something: true,
            obj: {
                whatever: true
            },
            extra: `This shouldn't be here.`
        };

        validator.validateModel('anything', o)
            .every((b: boolean) => b)
            .subscribe(() => {
                done('Validated anyway.');
            }, (err: any) => {
                done();
            });
    });

    it('Should not validate a modelData data not in schema. (full)',
        function (done: MochaDone): void {

            const o: any = {
                something: true,
                obj: {
                    whatever: true
                },
                extra: `This shouldn't be here.`
            };

            validator.validateModel('anything', o, true)
                .every((b: boolean) => b)
                .subscribe(() => {
                    done('Validated anyway.');
                }, (err: any) => {
                    done();
                });
        });

    it('Should create a schema from json with no name', function (done: MochaDone): void {
        const json: any = {
            type: {
                test1: 'Boolean',
                test2: 'String',
            }
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});
        assert.equal(SchemaManager.isSchemaResolved(schema), true, 'Schema is not resolved');
        assert.equal((<any>schema.type).test1, Boolean);
        assert.equal((<any>schema.type).test2, String);
        assert.equal(sm.hasSchema(schema.name), true);

        done();
    });


    it('Should create a schema from json a child schema', function (done: MochaDone): void {
        const json: any = {
            type: {
                random: 'String',
                child: {
                    isArray: true,
                    type: {
                        elem: 'Number'
                    }
                }
            }
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});
        assert.equal(SchemaManager.isSchemaResolved(schema), true, 'Schema is not resolved');
        assert.equal((<any>schema.type).random, String);
        assert.equal(sm.hasSchema(schema.name), true);
        assert.equal(sm.hasSchema((<ISchemaObject>(<any>schema.type).child).name), true);

        done();
    });

    it('Should check if a string map exists in a schema', function (done: MochaDone): void {
        const json: any = {
            type: {
                random: 'String',
                child: {
                    isArray: true,
                    type: {
                        elem: 'Number'
                    }
                }
            }
        };

        const json2: any = {
            isArray: true,
            type: {
                random: 'String',
                child: {
                    type: {
                        elem: 'Number'
                    }
                }
            }
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});
        const schema2: ISchemaObject = sm.registerSchemaFromJson(json2);
        expect(schema2.type).to.not.deep.equal({});

        SchemaManager.validateMap(schema, 'random')
            .flatMapTo(SchemaManager.validateMap(schema, 'child[0]'))
            .flatMapTo(SchemaManager.validateMap(schema, 'child[0].elem'))
            .flatMapTo(SchemaManager.validateMap(schema2, '[0].random'))
            .flatMapTo(SchemaManager.validateMap(schema2, '[0].child.elem'))
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should validate a custom type', function (done: MochaDone): void {
        const json: any = {
            type: {
                random: 'TestType',
            }
        };

        sm.registerType('TestType', (value: any): Observable<boolean> => {
            return Observable.of(value === '1');
        });

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, { random: '1' })
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should not validate a custom type', function (done: MochaDone): void {
        const json: any = {
            type: {
                random: 'TestType',
            }
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, { random: '2' })
            .every((b: boolean) => b)
            .subscribe(() => {
                done('Validated anyway');
            }, (err: any) => {
                done();
            });
    });

    it('Should validate invalid type because it\'s whitelisted.', function (done: MochaDone): void {
        const json: any = {
            type: {
                random: 'Number',
            }
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});
        validator.whitelistedKeys.push('random');

        validator.validateModel(schema.name, { random: 'this is a string' })
            .every((b: boolean) => b)
            .subscribe(() => {
                // Remove the whitelisted key we just added
                validator.whitelistedKeys.splice(validator.whitelistedKeys.length - 1, 1);
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should validate single type.', function (done: MochaDone): void {
        const json: any = {
            type: 'Number'
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, 11)
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should not validate single type.', function (done: MochaDone): void {
        const json: any = {
            type: 'Number'
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, { x: 1 })
            .every((b: boolean) => b)
            .subscribe(() => {
                done('Validated anyway.');
            }, (err: any) => {
                done();
            });
    });

    it('Should validate single type custom type.', function (done: MochaDone): void {
        const json: any = {
            type: 'TestType'
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, '1')
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should validate single type reference.', function (done: MochaDone): void {
        const json: any = {
            type: 'simple'
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, { count: 13 })
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should validate single type array.', function (done: MochaDone): void {
        const json: any = {
            type: [Number]
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, [1, 2, 3, 7])
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should not validate single type.', function (done: MochaDone): void {
        const json: any = {
            type: ['Number']
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, [{ x: 1 }])
            .every((b: boolean) => b)
            .subscribe(() => {
                done('Validated anyway.');
            }, (err: any) => {
                done();
            });
    });

    it('Should validate single type array reference.', function (done: MochaDone): void {
        const json: any = {
            type: ['simple']
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, [{ count: 13 }, { count: 26 }])
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should validate single type array custom type.', function (done: MochaDone): void {
        const json: any = {
            type: ['TestType']
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, ['1'])
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should validate array syntax.', function (done: MochaDone): void {
        const json: any = {
            type: {
                random: ['Number'],
                random2: [{
                    type: {
                        x: 'Number'
                    }
                }],
                other: 'String'
            }
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        // console.log('schema:', inspect(schema, false, null, true));

        validator.validateModel(schema.name, {
            random: [1, 2, 3, 4],
            random2: [{ x: 1 }, { x: 2 }, {}],
            other: 'hey'
        })
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should validate single value json schema array shorthand',
        function (done: MochaDone): void {
            const schema: ISchemaObject = sm.registerSchemaFromJson(['Number'] as any);

            validator.validateModel(schema.name, [1])
                .every((b: boolean) => b)
                .subscribe(() => {
                    done();
                }, (err: any) => {
                    done(err);
                });
        });


    it('Should copy schema', function (done: MochaDone): void {
        const json1: any = {
            name: 'poepJson',
            type: {
                random: Number,
                lol: 'String'
            },
            metaData: {
                lol: {
                    required: true
                }
            }
        };

        const json2: any = {
            name: 'poepJsonCopy',
            type: 'poepJson'
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json1);
        const schema2: ISchemaObject = sm.registerSchemaFromJson(json2);

        validator.validateModel(schema2.name, {
            random: 1,
            lol: 'haha'
        })
            .every((b: boolean) => b)
            .subscribe(() => {
                done();
            }, (err: any) => {
                done(err);
            });
    });

    it('Should validate shorthand metadata.', function (done: MochaDone): void {
        const json: any = {
            type: {
                name: String,
                links: {
                    type: Number,
                    metaData: {
                        minAmount: 5
                    }
                }
            }
        };

        const schema: ISchemaObject = sm.registerSchemaFromJson(json);
        expect(schema.type).to.not.deep.equal({});

        validator.validateModel(schema.name, {
            name: 'test',
            links: 3
        })
            .every((b: boolean) => b)
            .subscribe(() => {
                done('Validated anyway');
            }, (err: any) => {
                done();
            });
    });

    it('Should test if array shorthand gets converted correctly in toJson',
        function (done: MochaDone): void {
            const json: any = {
                name: 'kutzooi',
                type: {
                    key: String,
                    plugins: [String],
                    domain: String
                }
            };

            const schema: ISchemaObject = sm.registerSchemaFromJson(json);
            expect(schema.type).to.not.deep.equal({});

            const json1: any = sm.schemaToJson(schema.name);
            expect(json1.type.key).to.be.equal('String');
            expect(json1.type.domain).to.be.equal('String');

            const schema2: ISchemaObject = sm.getSchema((<any>schema.type).plugins.name);
            const json2: any = sm.schemaToJson(schema2.name);
            expect(json2.type).to.be.equal('String');

            done();
        });
});
