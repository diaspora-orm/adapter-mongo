'use strict';

const Diaspora = require( 'diaspora' );
const DataStoreEntity = Diaspora.components.Adapters.Entity;

// This class allows you to define custom logic with your datastore entity
class MongoEntity extends DataStoreEntity {
	constructor( entity, dataSource ) {
		super( entity, dataSource );
	}
}

module.exports = MongoEntity
