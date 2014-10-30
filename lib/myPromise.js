;(function(ns){

	function Df(){
		var promise_queue = [],
			success_cb_queue = [],
			fail_cb_queue = [],

			__STATE__ = [];
			__VALUE__ = [];

		function isPromiseObj( o ){
			if ( "undefined" == typeof o ) {
				return false;
			}
			var has = Object.prototype.hasOwnProperty;
			return has.call(o, "then") && "function" == typeof o.then ;
		}

		function Promise(){
			//var value;
			var state_idx;

			this.get_stateIdx = function(){
				return state_idx;
			}

			this.state = function(){
				return {
					"0" : "pending",
					"1" : "resolved",
					"2" : "failed"
				}[__STATE__[this.get_stateIdx()]];
			}

			this.then = function( success_cb, fail_cb){
				//console.log("then start!", +new Date);

				var len = promise_queue.push(this),
					i = len - 1;
					sq = success_cb_queue,
					fq = fail_cb_queue

					state_idx = i;

					__STATE__.push( this.__RESOLVED__ ? 1 : 0);

					//Q. to ensure i  === State.length -1,
					//keep these 2 index equal;
					if (sq[i] instanceof Array) {
						sq[i].push(success_cb);
					} else {
						typeof sq[i] == "undefined" ? (
							sq[i] = success_cb ) : (
							sq[i] = [sq[i], success_cb]
						)
					}

					return new Promise();

			}

			this.done = function(success_cb){
				success_cb.__IGNORE_RETVAL__ = true;
				this.then(success_cb);
			}
		}

		var o = new Promise();

		var __x__ = {
			promise: function(){
				return o;
			},

			then: function(success, fail){
				var u = o.then(success, fail);
				return u;
			}, 

			resolve: function( value ){
				//console.log("df resolve start!");

				if ( o.__NESTED_DF__ ) {
					o.__NESTED_DF__.resolve(value);
					return;
				}

				var target = this,
					delay_resolve_next;
				var a = promise_queue.shift(),
					b,
					s_cb = success_cb_queue.shift();

				var next_val;

				if (s_cb instanceof Array) {
					s_cb.forEach(function(scb, j, arr){
						var r = scb.apply(target,[value]);

						if ( !scb.__IGNORE_RETVAL__ ){
							next_val = r;

							if (isPromiseObj( next_val )){
								var e = promise_queue[0];
								isPromiseObj(e) && 
								( 
									//when then's callback return a promise
									//we replace the original empty promise
									//and as well under current structure
									//we need to use correct Deferred 's resolve.
									promise_queue[0] = next_val,
									next_val.__NESTED_DF__ = __x__
								);

							} else {
								//a ordinary value is returned;
								promise_queue.length == 0 ||
								(delay_resolve_next = true);
							}
						}

					})
				} else {
					if ( typeof s_cb == "function") {
						next_val = s_cb.apply(target, [value]);

						if ( isPromiseObj( next_val ) ) {
							var e = promise_queue[0];
							isPromiseObj(e) &&
							( 
								promise_queue[0] = next_val,
								next_val.__NESTED_DF__ = __x__
							 );

						} else {
							promise_queue.length == 0 ||
							(delay_resolve_next = true);
						}
					}
				}
				//debugger;

				var j = a.get_stateIdx()
				__STATE__[j] = 1;
				__VALUE__[j] = value;

				//when current succss_cb return an ordinary value,
				//use the returned value resolve next proimse.
				if (delay_resolve_next) {
					//b = promise_queue.shift();
					__x__.resolve.apply(target, [next_val]);
				}

			}
		}

		return __x__;
	}

	ns.Deferred = Df;

})(this);