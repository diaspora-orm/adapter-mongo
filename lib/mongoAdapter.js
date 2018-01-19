'use strict';

const {
	_, Promise,
} = require( 'diaspora/lib/dependencies' );
const Diaspora = require( 'diaspora' );
const DiasporaAdapter = Diaspora.components.Adapters.Adapter;
const MongoEntity = require('./mongoEntity');
const MongoClient = require( 'mongodb' ).MongoClient;
const f = require('util').format;

// Your adapter logic.

/**
 * This adapter provides a standardized interface with MongoDB, to be used within Diaspora
 *
 * @extends Adapters.DiasporaAdapter
 * @memberof Adapters
 * @public
 * @author gerkin
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
	constructor(config) {
		super( MongoEntity );

		if ( !config.hasOwnProperty( 'database' )) {
			throw new Error( 'Missing required string parameter "database".' );
		}
		// ### TODO
		// Support proxies ([see MongoDB Driver doc](http://mongodb.github.io/node-mongodb-native/2.2/reference/connecting/legacy-connection-settings/#mongos-proxy-connection))
		const defaults = {
			host:     'localhost',
			port:     27017,
			password: false,
			username: false,
			authSource: false,
		};
		const ORMKeys = _.concat( _.keys( defaults ), [ 'database' ]);
		const otherProps = _.omit( config, ORMKeys );
		_.defaults( config, defaults );
		this.config = config;

		const authPrefix = ( false !== config.username ? `${ config.username + ( false !== config.password ? `:${  config.password }` : '' )  }@` : '' );
		// Connection URL
		let url = 'mongodb://';
		let args = [];
		if(config.username){
			url += '%s';
			args.push(config.username);
			if(config.password){
				url += ':%s';
				args.push(config.password);
			}
			url += '@';
		}
		url += '%s:%s/%s';
		args.push(config.host, String(config.port), config.database);
		if(config.authSource){
			url += '?authSource=%s';
			args.push(config.authSource);
		}
		args = _.map(args, encodeURIComponent);
		url = f(url, ...args)

		Diaspora.logger.verbose(`Mongo connection URL:`, {url : url.replace( `${args[0]}:${args[1]}@`, `${args[0]}:******@` )});
		console.log(url);

		// Use connect method to connect to the server
		MongoClient.connect( url, otherProps, ( err, db ) => {
			if ( !_.isNil( err )) {
				this.emit( 'error', new Error( err ));
			} else {
				this.db = db;
				this.emit( 'ready' );
			}
		});
	}

	configureCollection( tableName, remaps, filters ) {
		// Call parent `configureCollection` to store remappings & filters
		super.configureCollection( tableName, _.assign(remaps, {
			id: '_id',
		}), _.assign({
			input: {
				id: queryVal => {
					return _.mapValues(queryVal, (val, operator) => {
						if(['$equal', '$diff'].indexOf(operator) > -1){
							return new require( 'mongodb' ).ObjectID( val )
						}
						return val;
					});
				},
			},
			output: {
				_id: val => val.toString(),
			},
		}, filters));
	}

	// -----
	// ### Utils

	close() {
		this.db.close();
		this.state = 'disconnected';
	}

	normalizeQueryMongo(query){
		const newQuery = {};
		_.forEach(query, (propQuery, propName) => {
			_.forEach(propQuery, (value, key) => {
				switch(key){
					case '$equal':{
						newQuery[propName] = {$eq: value};
					} break;
					case '$diff':{
						newQuery[propName] = {$ne: value, $exists: true};
					} break;
					case '$lessEqual':{
						newQuery[propName] = {$lte: value};
					} break;
					case '$greaterEqual':{
						newQuery[propName] = {$gte: value};
					} break;
					case '$less':{
						newQuery[propName] = {$lt: value};
					} break;
					case '$greater':{
						newQuery[propName] = {$gt: value};
					} break;
					default: {
						newQuery[propName] = { [key]: value};
					} break;
				}
			});
		});
		return newQuery;
	}

	/**
	 * Insert a single entity in the memory store.
	 *
	 * @summary This reimplements {@link Adapters.DiasporaAdapter#insertOne}, modified for MongoDB.
	 * @author gerkin
	 * @see http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne
	 * @param   {String} table  Name of the collection to insert data in
	 * @param   {Object} entity Hash representing the entity to insert
	 * @returns {Promise} Promise resolved once insertion is done. Called with (*{@link MongoEntity}* `entity`)
	 */
	insertOne( table, entity ) {
		entity = _.pickBy( entity, v => 'undefined' !== typeof v );
		const collection = this.db.collection( table );
		return collection.insertOne( entity ).then( res => {
			const newDoc = _.first( res.ops );
			return this.updateOne(
				table,
				{ _id: newDoc._id },
				{ $set: { [_.get(this, 'remaps.idHash', 'idHash')]: _.assign({}, newDoc.idHash, {
					[this.name]: newDoc._id.toString(),
				}) } },
				{ remapInput: false, mongoConvertQuery: false }
			);
		});
	}

	// -----
	// ### Find

	/**
	 * Retrieve a single entity from the local storage.
	 *
	 * @summary This reimplements {@link Adapters.DiasporaAdapter#findOne}, modified for MongoDB.
	 * @author gerkin
	 * @see http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOne
	 * @param   {String}                 table        Name of the model to retrieve data from
	 * @param   {SelectQueryOrCondition} queryFind    Hash representing the entity to find
	 * @param   {QueryOptions}           [options={}] Hash of options.
	 * @returns {Promise}                Promise resolved once item is found. Called with (*{@link InMemoryEntity}* `entity`)
	 */
	findOne( table, queryFind, options = {}) {
		// Create a new query object
		const queryOpts = _.pick(options, ['skip', 'limit']);
		if(_.get(options, 'mongoConvertQuery', true)){
			queryFind = this.normalizeQueryMongo(queryFind);
		}
		const collection = this.db.collection( table );
		let promise = collection.findOne( queryFind, queryOpts ).then( foundItem => {
			if(_.isNil(foundItem)){
				return Promise.resolve();
			}
			return Promise.resolve( options.remapOutput ? this.remapOutput( table, foundItem ) : foundItem );
		});
		return promise;
	}

	// -----
	// ### Update

	filterUpdateUnset( updateQuery ) {
		const $set = {};
		const $unset = {};
		_.forEach( updateQuery, ( val, key ) => {
			if ( 'undefined' === typeof val ) {
				$unset[key] = true;
			} else {
				$set[key] = val;
			}
		});
		const fullQuery = {};
		if ( !c.emptyObject( $unset )) {
			_.assign( fullQuery, {
				$unset,
			});
		}
		if ( !c.emptyObject( $set )) {
			_.assign( fullQuery, {
				$set,
			});
		}
		return fullQuery;
	}

	/**
	 * Update a single entity.
	 *
	 * @summary This reimplements {@link Adapters.DiasporaAdapter#updateOne}, modified for MongoDB.
	 * @author gerkin
	 * @see http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateOne
	 * @param   {String} table  Name of the collection to update data in
	 * @param   {SelectQueryOrCondition} queryFind Hash representing the entity to find
	 * @param   {Object} update Object properties to set
	 * @param   {QueryOptions} [options={}] Hash of options.
	 * @returns {Promise} Promise resolved once update is done. Called with (*{@link MongoEntity}* `entity`)
	 */
	updateOne( table, queryFind, update, options = {}) {
		const collection = this.db.collection( table );
		const subOptions = _.assign( options, {
			remapInput:  false,
			remapOutput: false,
		});
		if(_.get(options, 'mongoConvertQuery', true)){
			update = this.filterUpdateUnset(update);
		}
		return this.findOne( table, queryFind, subOptions ).then( foundItem => {
			return collection.updateOne({
				_id: foundItem._id,
			}, update, subOptions ).then(() => Promise.resolve( foundItem._id ));
		}).then( updatedId => {
			return this.findOne( table, {
				_id: { $eq: updatedId },
			}, _.assign( subOptions, {
				remapOutput: true,
			}));
		});
	}

	/**
	 * Update several entities.
	 *
	 * @summary This reimplements {@link Adapters.DiasporaAdapter#updateMany}, modified for MongoDB.
	 * @author gerkin
	 * @see http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateMany
	 * @param   {String} table  Name of the collection to update data in
	 * @param   {SelectQueryOrCondition} queryFind Hash representing entities to find
	 * @param   {Object} update Object properties to set
	 * @param   {QueryOptions} [options={}] Hash of options.
	 * @returns {Promise} Promise resolved once update is done. Called with (*{@link MongoEntity}[]* `entities`)
	 */
	updateMany( table, queryFind, update, options = {}) {
		const collection = this.db.collection( table );
		const subOptions = _.assign( options, {
			remapInput:  false,
			remapOutput: false,
		});
		if(_.get(options, 'mongoConvertQuery', true)){
			update = this.filterUpdateUnset(update);
		}
		return this.findMany( table, queryFind, subOptions ).map( foundItem => {
			return collection.updateOne({
				_id: foundItem._id,
			}, update, subOptions ).then(() => Promise.resolve( foundItem._id ));
		}).then( updatedIds => {
			return this.findMany( table, {
				_id: {
					$in: updatedIds,
				},
			}, _.assign( subOptions, {
				remapOutput: true,
			}));
		});
	}

	// -----
	// ### Delete

	/**
	 * Delete a single entity from the collection.
	 *
	 * @summary This reimplements {@link Adapters.DiasporaAdapter#deleteOne}, modified for MongoDB.
	 * @author gerkin
	 * @see http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteOne
	 * @param   {String}                 table        Name of the collection to delete data from
	 * @param   {SelectQueryOrCondition} queryFind    Hash representing the entity to find
	 * @param   {QueryOptions}           [options={}] Hash of options.
	 * @returns {Promise}                Promise resolved once item is deleted. Called with (*undefined*)
	 */
	deleteOne( table, queryFind, options = {}) {
		const collection = this.db.collection( table );
		if(_.get(options, 'mongoConvertQuery', true)){
			queryFind = this.normalizeQueryMongo(queryFind);
		}
		return collection.deleteOne( queryFind, options ).then( results => Promise.resolve());
	}

	/**
	 * Delete several entities from the collection.
	 *
	 * @summary This reimplements {@link Adapters.DiasporaAdapter#deleteMany}, modified for MongoDB.
	 * @author gerkin
	 * @see http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteMany
	 * @param   {String}                 table        Name of the collection to delete data from
	 * @param   {SelectQueryOrCondition} queryFind    Hash representing the entity to find
	 * @param   {QueryOptions}           [options={}] Hash of options.
	 * @returns {Promise}                Promise resolved once item is deleted. Called with (*undefined*)
	 */
	deleteMany( table, queryFind, options = {}) {
		const subOptions = _.assign( options, {
			remapOutput: false,
		});
		return this.findMany( table, queryFind, options ).then( found => {
			const collection = this.db.collection( table );
			return collection.deleteMany({
				_id: {
					$in: _.map( found, '_id' ),
				},
			}).then(() => Promise.resolve());
		});
	}
}

// Here, give a name to your adapter, and register it in Diaspora
// You should check for the environment variable AUTOLOAD_DIASPORA_ADAPTERS.
if(!process.env.NO_AUTOLOAD_DIASPORA_ADAPTERS){
	Diaspora.registerAdapter( 'mongo', MongoDiasporaAdapter );
}

// Optionnally, you can export it
module.exports = MongoDiasporaAdapter;
