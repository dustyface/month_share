;(function($, context, ns){

	function dirName( baseURI) {
		var path_RE = /(http(?:s)?:\/\/.+)\/[^\/]*/,
			arr = baseURI.match( path_RE )
		return arr && arr[1];
	}

	function capitalize(str){
		return str.replace(/^(.)(.*)/g, function(){
			var args = arguments
			return args[1].toUpperCase() + args[2]
		});
	}

	function uuid(len){
		var oldLen,
			s = "";

		for (var j = 0; j < len; j++){
			var t = parseInt(new Date().getTime() + Math.random() * (Math.random()* 9999 + 10000)) + "";

			var i = i % 2 == 0 ? ( t = parseInt(t.split("").reverse().join(""))):t;
			(i = i % 16 )> 9 && ( i = String.fromCharCode(i + 55)); //change to A-F
			s += i;
		}
		return s;
	}

	function MAC(){
		var s = uuid(12), ret ='';
		var RE = /../g;
		var m;
		while( (m = RE.exec(s)) != null ){
			ret += m[0] + ( RE.lastIndex == 12 ? "" : "-" );
		}
		return ret;
	}

	context.ns_publish( (ns.UTIL = {} ), {
		capitalize: capitalize,
		dirName: dirName,
		uuid: uuid
	});
	
})(jQuery, this, this);