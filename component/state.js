;(function($, context, ns){
	
	var o = context.ns_import("OOP, UTIL")，
		defineClass = o.defineClass;

	var _mediator = new (defineClass({
		construct: function(){
			var evts = [ "statechange" ];
			this.state = new UTIL.State;

			o.argument(this, this.constructor, o.pubSubPro, evts );
			this.publishEVentsBinder();
		},

		methods: {
			componentCache: [],

			register: function( widget ){
				var that = this;
				var o  = that.componentCache.filter(function(j, value){
					return value.constructor == widget.constructor;
				});

				o.length == 0 && that.componentCache.push( widget );
			},

			triggerSwitchState: function(){
				var ins = this;
				$.each(ins.componentCache, function(l, value){
					var w_statechange_promise = value.triggerHandler("statechange", [ins.state]);
					var _f = function(){};
					var f = $.isFunction(value.success_onstatechange) && value.success_onstatechange || _f, 
						g = $.isFunction(value.fail_onstatechange) && value.fail_onstatechange || _f

					w_statechange_promise.done(f)
									     .fail(g);
				})
			}
		}
	}));

	defineClass("State", {
		ns: "UTIL",
		construct: function( config ){
			this.mediator = _mediator;
			this.init(config)
		},

		methods: {
			init: function(){
				var state = this;

				state.index = config.defaultIndex || 0;
				$.aop.after({
					target: state,
					method: gotoState
				}, function(){
					_mediator.triggerSwitchState
				})
			},

			gotoState: function( stateIndex ){
				var state = this;
				var w = state.getActiveWidget();
				var success_cb = function(){
						state.index = stateIndex;
					},
					fail_cb = function(){
						console.log("fail to change state to " + stateIndex );
					}
				w.triggerHandler("beforestatechange", [this.index, stateIndex, this], success_cb)
			},

			getActiveWidget: function(){
				var state = this;
				state.mediator.componentCache[state.index];
			}
		}

	});


})(jQuery, this, this);