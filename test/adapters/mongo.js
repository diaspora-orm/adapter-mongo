'use strict';

const AdapterTestUtils = require( 'diaspora/test/adapters/utils' );
const ADAPTER_LABEL = 'mongo';

const adapter = AdapterTestUtils.createDataSource( ADAPTER_LABEL, {database: 'diasporaMongoTest'});
console.log(adapter)
adapter.waitReady().then(() => {
	adapter.db.dropCollection('test');
	adapter.db.dropCollection('app1-matchmail-simple');
}).catch(() => Promise.resolve());

AdapterTestUtils.checkSpawnedAdapter( ADAPTER_LABEL, 'Mongo' );
AdapterTestUtils.checkEachStandardMethods( ADAPTER_LABEL );
AdapterTestUtils.checkApplications( ADAPTER_LABEL );
AdapterTestUtils.checkRegisterAdapter( ADAPTER_LABEL, 'mongo' );
