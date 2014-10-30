;(function(ns){

	/*ns_publish((ns.UTIL = ns.UTIL || {}), {
		Deferred: Df
	})*/

	function Df(){

		var promise_queue = [],
			success_cb_queue = [],
			fail_cb_queue = [],

			__STATE__ = [];

		function isPromiseObj( o ){
			var has = Object.prototype.hasOwnProperty;
			return has.call(o, "then") && "function" == typeof o.then ;
		}

		function P(){
			var value;
			var state_idx;

			return {
				"get_stateIdx" : function(){
					return state_idx;
				},

				"state" : function(){
					return {
						"0" : "pending",
						"1" : "resolved",
						"2" : "failed"
					}[__STATE__[this.get_stateIdx()]];
				},

				"then" : function g(success_cb, fail_cb){
					console.log("then start!")
					promise_queue.push(this);
					var len = promise_queue.length;
					i = len - 1,
					sq = success_cb_queue,
					fq = fail_cb_queue;

					state_idx = i;
					__STATE__.push(0);

					if (sq[i] instanceof Array) {
						sq[i].push(success_cb);
					} else {
						typeof sq[i] == "undefined" ? (
							sq[i] = success_cb ) : (
							sq[i] = [sq[i], success_cb]
						)
					}

					return {
						then: g
					}
				}/*,

				"done" : function(){
					success_cb.__ignore_retval__ = true;
					this.then(success_cb);
				}*/
			}
		}

		var o = P();

		var __x__ = {
			promise: function(){
				return o;
			},

			then: function(success, fail){
				o.then(success, fail);
			}, 

			resolv: function( value ){
				var target = this,
					delay_resolve_next;
				var a = promise_queue.shift(),
					b,
					s_cb = success_cb_queue.shift();

				var next_val;

				if (s_cb instanceof Array) {
					s_cb.forEach(function(scb, j, arr){
						var r = scb.apply(target,[value]);

						if ( !scb.__ignore_retval__ ){
							next_val = r;

							if (isPromiseObj( next_val )){
								var e = promise_queue[0];
								isPromiseObj(e) && 
								( promise_queue[0] = r);

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
							( promise_queue[0] = next_val );
						} else {
							promise_queue.length == 0 ||
							(delay_resolve_next = true);
						}
					}
				}

				state[a.get_stateIdx()] = 1;

				if (delay_resolve_next) {
					b = promise_queue.shift();
					__x__.resolve.apply(target, next_val);
				}

			}
		}

		return __x__;
	}

	ns.D = Df;

})(this);