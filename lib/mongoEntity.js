'use strict';

const DataStoreEntity = require( 'diaspora/lib/dataStoreEntities/baseEntity' );

// This class allows you to define custom logic with your datastore entity
class MongoEntity extends DataStoreEntity {
	constructor( entity, dataSource ) {
		super( entity, dataSource );
	}
}

module.exports = MongoEntity