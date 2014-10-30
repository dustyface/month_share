;(function($, context, ns){

	var c = context,
		ns_import = c.ns_import,
		ns_publish = c.ns_publish,
		ns_resolveList = c.ns_resolveList;

	ns_publish(( ns.OOP = ns.OOP || {} ), {
		base: base,
		inherits: inherits,
		argument: argument,
		traverseUpProtoChain: traverseUpProtoChain,
		defineClass: defineClass
	});

	//base is a paired method with inherits. 
	//the property '__superClass__' is set by inherits, 
	//indicating the prototype object of one level up.
	function base(me, opt_methodName, var_args){
		var caller = arguments.callee.caller,
			slice = Array.prototype.slice

		//if __superClass__ present on caller,
		//it denotes the place we call this base method is from a constructor
		//so we call the superClass's constructor;
		if ( caller.__superClass__ ) {
			return caller.__superClass__.constructor.apply(me, slice.call(arguments, 1))
		}

		var args = slice.call(arguments, 2),
			foundCaller = false;

		//traverse start from me object's constructor, if found caller,
		//invoke the proper base method right at next round of for loop
		//on prototype chain.
		for (var ctor = me.constructor; ctor; ctor = ctor.__superClass__ && ctor.__superClass__.constructor ) {
			if ( ctor.prototype[opt_methodName] === caller ){
				foundCaller = true;
			} else if ( foundCaller ){
				return ctor.prototype[opt_methodName].apply(me, args);
			}
		}

		//if caller can't be found on prototype chains,
		//2 possible case:
		// - called from an instance method of me.
		// - wrong place.
		if ( me[opt_methodName] === caller ) {
			return me.constructor.prototype[opt_methodName].apply(me, args);
		} else {
			throw Error("failed to find base method! base possibly called from a method with one name" +
				"to a method with a different name!" );
		}
	}

	function inherits(childCtor, parentCtor){
		function tempCtor(){};
		tempCtor.prototype = parentCtor.prototype;
		//setup __superClass__, since __proto__ only has effect on mozilla;
		childCtor.__superClass__ = parentCtor.prototype;
		childCtor.prototype = new tempCtor();
		childCtor.prototype.constructor = childCtor;
	}

	//reference from :
	//http://yuilibrary.com/yui/docs/api/files/oop_js_oop.js.html#yui_3_18_0_2_1413895433226_4937
	//
	//i made some personal modification, as such:
	//
	function argument(ins, receiver, supplier, supplierConstructorArgs ){
		var rProto = receiver.prototype,
			sProto = supplier.prototype,
			
			//if receiver is an constructor;
			sequester = rProto && supplier, 
			to = rProto || receiver,

			copy,
			newPrototype,
			replacements,
			sequestered,
			unsequester;

		//bug fix:
		//it's a must to record this args property each time we call argument
		//rather than recording it as local variable, so that we can access it.
		ins.__SUPPLIER_ARGS__ = supplierConstructorArgs ? Array.prototype.slice.call(arguments, 3) : [];

		if ( sequester ) {
			newPrototype = {};
			replacements ={};
			sequestered = {};

			copy = function(key, value){
				if ( !( key in rProto )) {
					
					//as to each function property on supplier, 
					//we tackle it specially.
					if ( $.isFunction( value )) {
						//keep the supplier's original property in sequestered space;
						sequestered[key] = value;
						newPrototype[key] = replacements[key] = function(){
							//this=> the final object on which we invoke 
							//this supplier's method, of course, for 
							//invocation of first time, it's not the 
							//original method of supplier but this tweaked one.
							return unsequester(this, value, arguments, this.__SUPPLIER_ARGS__);
						}
					} else {
						//as to those property which is not a funciton
						//we assign it directly to the intermediate place.
						newPrototype[key] = value;
					}
				}
			};

			unsequester = function(ins, fn, fnArgs, supplierInsArgs) {
				var _has = Object.prototype.hasOwnProperty;
				$.each(sequestered, function(key, value){

					//resume the supplier's original method.
					_has.call(sequestered, key) &&
					( ins[key] === replacements[key] ) &&
					( ins[key] = sequestered[key] )
				})
				//it must be supplierInsArgs, 
				supplier.apply(ins, supplierInsArgs)
				//call the specific method.
				return fn.apply(ins, fnArgs);
			};

			//upon supplier, setup the sequester mechanism;
			$.each(sProto, copy);

			//setup to object, the receiver prototype;
			$.each(newPrototype || sProto, function(key, value){
				to[key] = value;
			});

			return ins;
		}
	}

	//traverse upward on prototype, looking for the property, 
	//if found, than call the callback at one level above the 
	//position of property exist.
	function traverseUpProtoChain(obj, property, callback){
		var proto = obj.constructor.prototype,
			has = Object.prototype.hasOwnProperty,
			gotcha = false;

		while ( proto != Object.prototype ) {
			if ( property in proto ) {
				if ( has.call(proto, property )) {

					gotcha === false && ( gotcha = true )

					proto.constructor.__superClass__ && 
					( callback( proto.constructor.__superClass__, property ), 1) || 
					( proto = Object.prototype )
					break;
				} else {
					proto = proto.constructor.__superClass__ || Object.prototype;
				}
			} else {
				//if the property doesn't exist in prototype object,
				//that mean the obj has no such property, just call callback.
				callback( proto, property );
				break;
			}
		}

		if ( proto === Object.prototype ) {
			//bug fix:
			//without judging the gotcha, it might invok twice.
			if ( has.call( proto, property ) && !gotcha ) {
				throw new Error("Bomb, Object.prototype has this property:" + property );
			} else {
				//in this branch, it's that we found the property on certain level
				//prototype object, but the one level up prototype is Object.prototype, this oop system doesn't set __superClass__ pointing to 
				//Object.prototype, so loop of above will break without calling callback even we found the property.
				//we should NOT invoke callback, when proto reaches Object.prototype.
				//when coorperating with some framework, e.g. jQuery, polluting 
				//Object.prototype make the framework stop to work!
				throw new Error("Bomb, though we found the property, but we should NOT pollute Object.prototype!")
			}
		}
	}

	function defineClass( name,  classDef ){
		var anonymous = arguments.length == 1
		anonymous && (classDef = name );

		var class_name = name,
			ctor = classDef.construct,
			nslist = !anonymous && classDef.ns && ns_resolveList(classDef.ns) || (!anonymous && [window]) || "",
			parentCtor = classDef.extend,
			methods = classDef.methods,
			statics = classDef.statics;

		if ( !ctor ){
			throw new Error("there must be an construct property to define the constructor of the module!");
		}

		if ( $.isFunction( parentCtor) ){
			inherits(ctor, parentCtor)
		}

		//it's must to call inherits first and then copy methods to
		//its prototype object, the order must be as such. put it 
		//reversed, the prototype object will be changed by inherits method! 
		if ( methods ){
			$.extend(ctor.prototype, methods);
		}

		if ( statics ){
			$.extend(ctor, statics);
		}

		//publish to that namespace.
		if ( nslist ) {
			$.each(nslist, function(j, e_ns){
				var o = {};
				o[class_name] = ctor;
				ns_publish(e_ns,  o);
			});
		}

		return ctor;
	}

})(jQuery, this, this);