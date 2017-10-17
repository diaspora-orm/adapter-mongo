'use strict';

/* globals l: false, it: false, describe: false, require: false, expect: false, Diaspora: false, getStyle: false, importTest: false */

require( 'diaspora/test/defineGlobals' );
require( '../index' );

if ( 'no' === process.env.SAUCE || 'undefined' === typeof process.env.SAUCE ) {
	if ( !process.browser ) {
		global.Diaspora = require( 'diaspora' );
	}
	global.dataSources = {};

	importTest( getStyle( 'category', 'Adapters' ), `${ __dirname  }/adapters/mongo.js` );
}
