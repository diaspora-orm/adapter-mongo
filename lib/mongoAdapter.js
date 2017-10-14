'use strict';

const DiasporaAdapter = require( 'diaspora/lib/adapters/baseAdapter' );
const MongoEntity = require('./mongoEntity')

// Your adapter logic.

/** 
 * This class is used to use local storage or session storage as a data store. This adapter should be used only by Node.JS.
 * 
 * @extends Adapters.DiasporaAdapter
 * @memberof Adapters
 */ 
class MongoDiasporaAdapter extends DiasporaAdapter {
	/**
	 * Create a new Mongo data store 
	 * 
	 * @author gerkin 
	 * @param {Object}       [config]                - Options hash. 
	 * @param {string}       config.database         - Name of the database.
	 * @param {string}       config.host='localhost' - Host address of the target MongoDB instance.
	 * @param {integer}      config.port=27017       - Port of the target MongoDB instance.
	 * @param {string}       config.username=false   - Username used to connect. 
	 * @param {string|false} [config.password=false] - Password used to connect. Set to false to disable password authentication.
	 */
	constructor() {
		super( MongoEntity, { 
			id: '_id', 
		}, { 
			input: { 
				id: val => new require( 'mongodb' ).ObjectID( val ), 
			}, 
			output: { 
				_id: val => val.toString(), 
			}, 
		});
	}

	configureCollection( tableName, remaps ) {
		// Call parent `configureCollection` to store remappings & filters
		super.configureCollection( tableName, remaps );
		// Then, create your schema.
		// Once you are done, don't forget to do one of the following:
		this.emit( 'ready' ); // Everything is okay
		this.emit( 'error', new Error()); // An error happened
	}

	// Implement at least one method of each couple
	// Insertion
	async insertOne( table, entity ) {}
	async insertMany( table, entity ) {}
	// Search
	async findOne( table, queryFind, options ) {}
	async findMany( table, queryFind, options ) {}
	// Update
	async findOne( table, queryFind, update, options ) {}
	async findMany( table, queryFind, update, options ) {}
	// Deletion
	async deleteOne( table, queryFind, options ) {}
	async deleteMany( table, queryFind, options ) {}
}

// Here, give a name to your adapter, and register it in Diaspora
Diaspora.registerAdapter( 'mongo', MongoDiasporaAdapter );

// Optionnally, you can export it
module.exports = MongoDiasporaAdapter;