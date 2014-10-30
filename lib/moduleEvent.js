(function($, context, ns){

	var _ns = context.ns_import("UTIL,OOP"); 
	
	var cap = _ns.capitalize,
		defineClass = _ns.defineClass,
		traverseUpProtoChain = _ns.traverseUpProtoChain;

	var uuid = function(){
		return _ns.uuid(5);
	}

	var methodDefs = {
		publishEventsBinder: function(){
			var mod = this,
				_evt_list = mod.__MODULE_EVENT_LIST__;

			$.each(_evt_list, function(j, evt){
				var _capedName = cap(evt);

				traverseUpProtoChain( mod, "_bind" + _capedName, function(thisProto, property){

					thisProto[property] = function(listener, isAsync){
						//bug fix:
						//note: here, 'this' must be used rather than 'mod';
						var listener_record = this._tweakUserListener( evt, listener, isAsync );
						this.evtPesudoObj.bind(evt, listener_record.tweakedListener );

						return listener_record;
					}
				});
			})
		},

		bind: function(eventName, listener, isAsyncListener ){
			var component = this,
				_capedName = cap(eventName),
				binderName = "_bind" + _capedName,
				listenerBindRecord

			if ( $.isFunction(component[binderName]) ){
				listenerBindRecord = component[binderName](listener, isAsyncListener)
			}

			//this is for backward compatibiltiy
			//as the web-theme-editor project use chained bind method.
			$.extend( listenerBindRecord, {
				"bind" : $.proxy(arguments.callee, this)
			});

			return listenerBindRecord;
		},

		_tweakUserListener : function( eventName, listener, containAsyncOp){
			var component = this,
				pool = component.listenerPool;

			var handler = $.proxy(listener, component),
				_a_deferred = new $.Deferred();

			var _uuid = uuid();

			//bug fix: 
			//we should NOT put uuid on this original listener,
			//1. because one function as a listener can be reused for many times, 
			//it's one single function instance, so if adding to it will overrid
			//the possible previous one.
			//
			//2. if we wannt consume the uid, as what we cound do in handlers,
			//from the original handler, we can't fetch the correct uuid!
			//
			//we should add uuid on tweaked listener!
			//
			//listener.__LISTENER_UUID__ = uuid();

			var listener_record = {
				"originalListener" : listener,
				"tweakedListener" : handler,
				"deferred" : _a_deferred,
				"promise" : _a_deferred.promise(),
				"resolve" : function( value ){
					this.deferred.resolve( value );              //todo: add passed in params;
					this._renewDeferredObj();
				},

				"reject" : function( value ){
					this.deferred.reject( value );
					this._renewDeferredObj();
				},

				"_renewDeferredObj" : function(){
					var _a_new_deferred = new $.Deferred();
					this.deferred = _a_new_deferred;
					this.promise = _a_new_deferred.promise();
				}
			};

			var _checkBefore_handler = $.aop.before({
				"target" : listener_record,
				"method" : "tweakedListener"
			}, function(listener_argsArray, methodName ){

				//the arugments passed in by aop's before action is the 
				//arguments passed to real user handlers.
				//[0] is the event object!  
				var _e = listener_argsArray[0];

				//before every handler's execution, we update its __LISTENER_UUID__
				_e.__LISTENER_UUID__ = _uuid;

				var t = _e.isImmediateStoped();

				//if we dont enter the latter real user handler, we must reject it,
				//otherwise the handler's promise might remain unresolved or unrejected.
				if ( !t ){
					listener_record.reject();
				}

				//returnning false would stop the real user handler from executing;
				return t;
			})[0];

			listener_record.tweakedListener = _checkBefore_handler;

			//adding the default after behaviour for sync handler( bind without the 3rd param)
			containAsyncOp || $.aop.after({
				target: listener_record,
				method: "tweakedListener"
			}, function( returnValue, methodName ){
				var _mn, _a;

				console.log( "after user handler, check returnValue", returnValue);

				//when certain one handler returning fasle, it inform the component
				//that event handler of this type's  condition fail.
				false === returnValue && ( _mn = "reject" ) || (
				 _mn = "resolve" );

				console.log("check default after aop:", _mn);
				listener_record[ _mn ]();
			});

			listener_record.tweakedListener.__LISTENER_UUID__ = _uuid;
			//record current event type's handlers in this.listenerPool;
			component._recordListener(eventName, listener_record);
			
			return listener_record;
		},

		_recordListener: function(eventName, record){
			var component = this;
			var pool = component.listenerPool,
				uuidTag = record.tweakedListener.__LISTENER_UUID__;

			var slice = Array.prototype.slice;
			
			//establish uuid-record hash map
			component.listenerRecordMap[uuidTag] = record;

			var hasRecord = component.listenerPool[eventName];
			if ( !hasRecord || 0 == hasRecord.length ) {
				pool[ eventName ] = [ record ];

				component.eventsMap[ eventName ] = new $.Event(eventName, {
					
					//choose another name, since the name will
					//conflict with jquery event object's built in
					//method, isImmediatePropagationStoped, stopImmediatePropagation;
					isImmediateStoped: function(){
						return this.__CONTINUE_OTHER_LISTENER__
					},
					immediateStop: function(){
						this.__CONTINUE_OTHER_LISTENER__ = false;
					}, 

					getListenerPromise: function( listener_UUID ){
						return component.listenerRecordMap[ listener_UUID ];
					},

					__CONTINUE_OTHER_LISTENER__: true
				});

			} else {
				pool[ eventName ].push( record );
			}

		},

		getListeners : function( eventName ){
			return this.listenerPool[ eventName ] || [];
		},

		getEventObj : function( eventName ){
			return this.eventsMap[ eventName ];
		},

		/**
		 * @method triggerHandler
		 * @param {String} eventName The name of event
		 * @param {Array} userData The data passed in the handler, 
		 * e.g.
		 * triggerHander('load', [100,'haha']), in the handler, there will be arguments as such:
		 * handler(event, d1, d2); d1 =>100, d2=>'haha'
		 * @param {function} callbacks (todo) 
		 *
		 */
		triggerHandler: function( eventName, userData  ){
			var component = this,
				_e_dom = this.evtPesudoObj,

				//for those there is no handler binded;
				_e_event = component.getEventObj( eventName );

			var promises = $.map( component.getListeners(eventName), function(item, idx){
				return item.promise;
			}),
				args = arguments,
				emptyFn = function(){},
				isFn = function( a ){ return $.isFunction(a) },
				getArgFn = function( n ) { return isFn(args[n]) ? args[n] : emptyFn },
				success_cb = getArgFn(2),
				fail_cb = getArgFn(3),
				progress_cb = getArgFn(4);

			var ret_promise = $.when.apply($, promises);

			if ( args.length > 2 ){
				ret_promise.then( success_cb, fail_cb, progress_cb );
			}

			if ( _e_event ) {
				var param = [component ].concat(userData);
				_e_dom.triggerHandler.apply(_e_dom, [ _e_event, param]);
			}

			return ret_promise;

		},

		unbind: function( eventName, listener ){
			var args = arguments,
				mod = this,
				pe_dom = mod.evtPesudoObj,
				//pool = this.listenerPool,
				len = args.length,
				s_exp = len == 0 || len == 1 ? len : (
						len >= 2 && 2 || void 0 );

			if ( !(eventName in mod.listenerPool) ) {
				return;
			}

			function filterListenerMapByEvent( eventName ){
				var hi = mod.listenerPool[ eventName ];
				$.each(hi,function(i, v){
					var _n = v.tweakedListener.__LISTENER_UUID__;
					delete mod.listenerRecordMap[_n];
				})
			}

			switch ( s_exp ) {
				case 0:
				//unbind all handlers of all type;
					pe_dom.unbind();
					mod.listenerPool = {};
					mod.eventsMap = {};
					mod.listenerRecordMap = {};
					break;
				case 1: 
				//unbind all handlers of this eventName type;
					filterListenerMap(eventName);
					pe_dom.unbind.apply(pe_dom, [eventName]);
					delete mod.listenerPool[eventName];
					delete mod.eventsMap[eventName];
					break;
				case 2:
				//unbind pointed listeners
					var hs, idx;
					$.each(mod.listenerPool[eventName], function(j, record){
						if (record["originalListener"] === listener) {
							hs = record;
							idx = j;
							return false;
						} 
					})

					if (hs) {
						mod.listenerPool[eventName].splice(idx, 1);
						delete mod.listenerRecordMap[hs.tweakedListener.__LISTENER_UUID__];
						pe_dom.unbind.apply(pe_dom, [eventName, hs.tweakedListener]);
					}
					break;
			}
			return mod;
		}

		/*
		,
		//todo:
		one: function(eventName, listener){

		}*/
	}

	function CompEvent( eventList ){
		/**listenerPool format sample:
		 *
		 *{
		 *	"event1" : [ listernReocrd, ...]
		 *	"event2" : [ listernRecord,...]
		 *}
		 */
		this.listenerPool = {};

		/**
		 *eventsMap format:
		 *{
		 *	"event1" : $.Event object,
		 *	"event2" : $.Event object;
		 * }
		 */
		this.eventsMap = {};

		/**
		 *listenerRecordMap record all record, refereced by uuid
		 *{
		 *	59C75 : listenerRecord,
		 *	B1850 : listernRecord,
		 *	....
		 *}
		*/
		this.listenerRecordMap = {};
		this.evtPesudoObj = $("<div></div>");
		this.MODULE_EVENT_LIST = eventList;
	}

	defineClass("ModuleEvent", {
		ns: "UTIL,OOP,EVENT", //"ns1.ns2.ns3,ns1,ns4"
		construct: CompEvent,
		methods:  methodDefs
	});

})(jQuery, this, this)