;(function($, context){

	//from : sample is as such:
	//       "ns1.ns2.ns3,ns4.ns6,ns4,ns3"
	function ns_import (from, based){
		var _ns_s = ns_resolveList(from, based),
			result = {};

		$.each( _ns_s, function( j, item ){
			var e_ns = item;
			$.each((e_ns["exports"] || "").split(","), function(k, value){
				result[ value ] = e_ns[ value ];
			});
		});

		return result;
	}

	function ns_publish(target, container ) {
		var _has = Object.prototype.hasOwnProperty;

		function addToExportsList(target, name){
			!target.exports ? ( target.exports = "" + name ) : ( target.exports += "," + name );
		}

		$.each(container, function(key,value){
			if ( !_has.call(target, key) ) {
				target[key] = value;
				addToExportsList(target, key);
			}
		})
	}

	function ns_resolveList( nslist, based ){
		var _based_ns = based || context;
		var lists = nslist.split(",");
		var retList = [];
		$.each(lists, function(i, e){
			var m = e.split(".")
			if ( 1 == m.length ) {
				retList.push( (_based_ns[m] = _based_ns[m] || {} ))
			} else {
				var one = _based_ns;
				$.each(m, function(j, x){
					one = (one[x] = one[x] || {} );
				})
				retList.push(one);
			}
		});

		return retList;
	}

	ns_publish(context, {
		"ns_resolveList" : ns_resolveList,
		"ns_publish" : ns_publish,
		"ns_import" : ns_import
	});


})(jQuery, this)