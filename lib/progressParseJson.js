/*
 * parse the json piece by piece in xhr's progress event handler;
 * 
 * author: cangpeng@xiaomi.com
 *
 */

//================ varaibles =======================
var rs = [
	"^\\s*(\\[|{).+",  //object_start;
	"^\\s*(\"|\')([a-zA-Z_][\\w]+)(\\1)\\s*:.+$",  //prop_value
	"^\\s*(\\d+(?:\.\\d+)?|true|false|null|(\"|\')([^\\2]*)\\2)\\s*$" , //built_in_type
	"\\s*((?:}\\s*)+)\\s*",   //multi_curly_end;
	"\\s*((?:\]\\s*)+)\\s*"   //multi_bra_end;
];

var stack = [],
	__NODE_ENV__ = { root: true },
	g_result,
	g_lastPass,

	receivedData = "",
	reminder = "",
	datas = [],
	reminders = [];

// ========= the goto-action table ===================
var portalMap = {};
var bracketMap = {};
var actions = [
	//object_start actions
	//"\\s*(\\[|{).+"
	[
		function action( m ){
			//m[0] = strip_lt_str(m[0]);
			var result = "[" == m[1] ? [] : {};
			stack.push([ m[1], result, m ]);
		},

		function postAction ( m ){
			return  [
				strip_lt_str(m[0]).substring(1),
				{ "prefixChar" : m[1] }
			]
		}
	],

	//prop_value actions
	//"^\\s*(\"|\')([a-zA-Z_][\\w]+)(\\1)\\s*:.+$"
	[
		function action( m ){
			//m[0] = strip_lt_str(m[0]);

			var o = stack[stack.length - 1],
				//p = strip_lt_str(m[0].substring(0, m[0].indexOf(":")));
				p = m[2];
			o[1][p] = "pending";
			
		},

		function postAction( m ){
			return [
				m[0].substring(m[0].indexOf(":") + 1),
				{ 
					"prefixChar" : ":",
					"associated_prop" : m[2]
				}
			]
		}
	],

	//built_in_type actions:
	//"^\\s*(\\d+|true|false|null|(\"|\').+\\1)\\s*$"
	[
		function action( m ){
			//m[0] = strip_lt_str(strip_lt_str(m[0]), "(:?\"|\')");
			var result,
				t;
				
			(result = {
				"null" : null,
				"true" : true,
				"false" : false
			}[m[1]] ) === undefined  && 
			( result = (t = m[1].match(/^\d+(\.\d+)?$/)) ? ( t[1] ? parseFloat(m[1]) : parseInt(m[1]) ) : m[3] );

			var o = stack[stack.length - 1],
				p = m.setting;
			
			p.prefixChar == ":" && ( o[1][p["associated_prop"]] = result, 1 ) ||
			p.prefixChar == "[" && ( o[1].push(result) );

		},

		function postAction ( m ) {
			//pass on the prefixchar if it's [;
			var p = m.setting,
				o = {};
			p.prefixChar == "[" && ( o.prefixChar = "[");
			//p.prefixChar = ":" && ( o.prefixChar = "{" )

			return [ m[0].substring(m.lastIndex), o]
		}
	],

	//multi_curly end tag actions:
	//"\\s*(}+)\\s*"
	[
		function action( m ){
			m[1] = m[1].replace(/\s/g, "");

			var len = m[1].length, 
				k = 0;
			while (k++ < len ){
				cb_curlyEnd_postAction();
			}	
		},

		function postAction( m ){
			var s = m[0].substring(m.lastIndex);
			return [ s,{} ];
		}
	],

	//multi_bra end tag actions:
	//"\\s*(\\]+)\\s*" 
	[
		function action( m ){
			m[1] = m[1].replace(/\s/g, "");

			var len = m[1].length, 
				j = 0;
			while ( j++ < len ) {
				cb_bracketEnd_postAction();
			}
		},

		function postAction( m ){
			var y = m[0].substring(m.lastIndex);
			return [y, {}];
		}
	]
];

function init_portalMap(){ 
	[0,1,2].forEach(function(e){
		portalMap[ new RegExp(rs[e], "g").toString() ] = actions[e];
	});
}

function init_braMap(){
	[3,4].forEach(function(i){
		bracketMap[ new RegExp(rs[i], "g").toString() ] = actions[i]
	});
}

// ================== functions =====================
function strip_lt_str(str, metaStr) {
	var lt = !metaStr ? "\\s*" : metaStr;
	return str.replace(new RegExp( lt + "(.+)" + lt ), "$1");
}

function isFunction(fn){
	return Object.prototype.toString.call(fn) == "[object Function]";
}

function match(regExp, str, setting ){
	var matched = regExp.exec(str);

	if ( matched ) {
		matched.lastIndex = regExp.lastIndex;
		setting && (matched.setting = setting );

		return [regExp.toString(), matched];
	}
}

function init(){
	init_portalMap();
	init_braMap();
}

function preProcess(data, end) {
	var j = 0, c;

	j = data.lastIndexOf(",");

	if ( !end ) {
		c = j == -1 ? ( data.substring(0) ) : data.substring(0, j) ;
	} else {
		c =  data;
		g_lastPass = true;
	}

	all = reminder.length == 0 ? c : reminder + c;

	//save info for this pass;
	reminder = j ==  -1 && reminder + c || 
			  ((j + 1 >= data.length || end )? "" : data.substring( j + 1 ) );
	receivedData += data;
	datas.push(data);
	reminders.push( reminder );

	//pre-process 
	return (j == -1 && !end) ? "" : all;
}

function evaluate(data, end) {

	var s = preProcess(data, end);

	if ( s.length == 0){
		return;
	}

	var parts = s.split(","),
		j = 0,
		len = parts.length,
		piece;

	while ( j < len ) {
		piece = handleOnePiece(parts[j]);

		if ( piece.length > 0 ) {
			//addding to error table;
			console.log( "piece unparsed: [" + piece + "] on [" + parts[j] + "]");

			//bug fix: test case 2
			//if in certain round pass of parsing, piece can NOT be consumed;
			//there must be structural error, since we split them ";"
			//for multiple continuous piece that are not able to parse to anything
			//we should update reminder as those has'nt parsed yet.
			s == reminder && 
			( reminder = piece, reminders[ reminders.length - 1] = piece )
		}

		//bug fix: test case 2:
		//
		if ( piece.length == 0 && j == len - 1 && s ==  reminder) {
			reminder = "";
			reminders[reminders.length - 1] = "" ;
		}

		j++;
	}
	
	return g_result ? g_result : stack;
}


function cb_bracketEnd_postAction(){
	//handle single ] end tag
	var o = stack.pop(),
		p = stack[ stack.length - 1],
		q = o[2]["setting"];

	q["prefixChar"] == ":" && ( p[1][q["associated_prop"]] = o[1] );
	q["prefixChar"] == "[" && ( p[1].push(o[1]) );

	q["root"] == true && ( g_result =  o[1] );

}

function cb_curlyEnd_postAction(){
	// handle single } end tag,
	//check these 2 function are totally same;
	var o = stack.pop(),
		p = stack [ stack.length - 1],
		q = o[2].setting;

	q["prefixChar"] == ":" && ( p[1][q["associated_prop"]] = o[1]);
	q["prefixChar"] == "[" && 
	( 
		p[1].push(o[1]), 

		__NODE_ENV__ = { "prefixChar": "[" }
	);

	q["root"] == true && ( g_result = o[1] );

}

function handleOnePiece( piece ){

	var s = piece;

	while (s.length != 0) {

		//debugger;

		var bNoMatched = [0,1,2].every(function(e, j, a){
			var pass = match(new RegExp( rs[e], "g"), s, __NODE_ENV__ );

			if ( !pass ){
				return true;
			}

			var type= pass[0],
				ma = pass[1],
				mret;
			
			//debugger;

			var act = portalMap[ type ];
			if ( isFunction( act[0] ) ){
				act[0]( ma );  //action to be taken;
				mret = act[1]( ma );  //postAction to be taken;

				//upate the s value and setting object;
				s = mret[0];
				__NODE_ENV__ = mret[1];
			}
		});

		//if all these 3 entry dont match, then i should start to seek } or ];
		if ( bNoMatched && s.length != 0 ) {
			var top = stack[stack.length - 1];
			
			//check stack top
			if ( top[0] == "[" ){
				s = handleRestPart(s, "]", cb_bracketEnd_postAction );

			} else if ( top[0] == "{") {
				s = handleRestPart( s, "}", cb_curlyEnd_postAction );
			}

			if  (s.length != 0 && !g_lastPass){
				break;
			}

			if (s.length != 0 && g_lastPass) {
				throw new Error("failed to pass in last round on : " + s)
			}
		}

		//output s for debug:
		console.log("s: ", s);
	}

	return s;

	function handleRestPart(input, tag, callback_postAction ){
		var _parts_ = input.split(tag),
			j = 0;

		while( j < _parts_.length ) {

			//bug fix:
			//test case 5:
			var a = _parts_[j],
				aPieceSuccess = true;

			while ( a.length != 0 ) {

				//bug fix: 
				if ( /^\s+$/.test(a) ) {
					//directly to call callback_postAction;
					break;
				}

				var bNoMatched = [0,1,2].every(function(e){
					var pass = match(new RegExp( rs[e], "g"), a, __NODE_ENV__ ),
						type, 
						ma,
						mret,
						act

					if ( !pass ) {
						return true;
					}
					
					type = pass[0];
					ma = pass[1];
					act = portalMap[ type ];
					if ( isFunction( act[0] ) ) {
						act[0](ma);  //action taken;
						mret = act[1]( ma );

						//update str and setting object;
						a = mret[0];
						__NODE_ENV__ = mret[1];

					}
				});

				if ( bNoMatched && a.length != 0){
					var idx = tag == "]" ? 3 : 4;
					var g = match(new RegExp( rs[ idx ], "g"), a, __NODE_ENV__);

					//bug fix: test case 3
					//adding g_lastPass and aPieceSuccess logic.
					//when even a single terminal token can NOT be parsed throught multiple 
					//continuous pieces.
					//
					if ( !g && g_lastPass ) {
						throw new Error("fail to parse elem! on: " + a );
					}

					if ( g ) {
						var type = g[0], ma = g[1];
						var act = bracketMap[ type ];
						var mret;

						if ( isFunction( act[0]) ) {
							act[0]( ma );
							mret = act[1]( ma );

							a = mret[0];
							__NODE_ENV__ = mret[1];
						}
					} else {
						aPieceSuccess = false;
						break;
					}
				}
			} //end of inner while, handling each piece.

			//if failed to match current piece, it denotes that the rest part,
			//can NOT be parsed to anything, if it's not the last round, we pass 
			//the work to next round;
			if ( !aPieceSuccess ) {
				break;
			}

			//execute the tag postAction except for the last round loop;
			if ( j != _parts_.length - 1 ) {
				callback_postAction();
			}

			j++;
		} //end of outer while,handling parts.

		if (j == _parts_.length ){
			return "";
		} else {
			//if parsing the rest part failed, we return the lefted string;
			return input.substring( input.indexOf( _parts_[j] ));
		}
	}
}