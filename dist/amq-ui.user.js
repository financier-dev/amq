// ==UserScript==
// @name         AMQ UI
// @namespace    amq-ui
// @version      0.1.0
// @author       Financier
// @description  Reimplementation of the Anime Music Quiz interface
// @license      MIT
// @match        https://animemusicquiz.com/*
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function () {
	'use strict';

	var _unsafeWindow = /* @__PURE__ */ (() => typeof unsafeWindow != "undefined" ? unsafeWindow : void 0)();

	const POLL_INTERVAL_MS = 200;
	function poll(isReady, timeoutMs) {
	  return new Promise((resolve, reject) => {
	    const deadline = Date.now() + timeoutMs;
	    const tick = () => {
	      let ready = false;
	      try {
	        ready = isReady();
	      } catch {
	        ready = false;
	      }
	      if (ready) return resolve();
	      if (Date.now() > deadline) {
	        return reject(new Error("[amq] timed out waiting for AMQ to load"));
	      }
	      setTimeout(tick, POLL_INTERVAL_MS);
	    };
	    tick();
	  });
	}
	function ensureLoad(timeoutMs = 6e4) {
	  return poll(
	    () => typeof Listener !== "undefined" && typeof socket !== "undefined" && socket._socket !== void 0 && typeof viewChanger !== "undefined" && viewChanger.__controllers !== void 0 && typeof roomBrowser !== "undefined",
	    timeoutMs
	  );
	}

	const EACH_ITEM_REACTIVE = 1;
	const EACH_INDEX_REACTIVE = 1 << 1;
	/** See EachBlock interface metadata.is_controlled for an explanation what this is */
	const EACH_IS_CONTROLLED = 1 << 2;
	const EACH_IS_ANIMATED = 1 << 3;
	const EACH_ITEM_IMMUTABLE = 1 << 4;

	const TEMPLATE_FRAGMENT = 1;
	const TEMPLATE_USE_IMPORT_NODE = 1 << 1;

	const UNINITIALIZED = Symbol('uninitialized');

	const NAMESPACE_HTML = 'http://www.w3.org/1999/xhtml';

	const DEV = false;

	// Store the references to globals in case someone tries to monkey patch these, causing the below
	// to de-opt (this occurs often when using popular extensions).
	var is_array = Array.isArray;
	var index_of = Array.prototype.indexOf;
	var includes = Array.prototype.includes;
	var array_from = Array.from;
	var define_property = Object.defineProperty;
	var get_descriptor = Object.getOwnPropertyDescriptor;
	var get_descriptors = Object.getOwnPropertyDescriptors;
	var object_prototype = Object.prototype;
	var array_prototype = Array.prototype;
	var get_prototype_of = Object.getPrototypeOf;
	var is_extensible = Object.isExtensible;

	const noop = () => {};

	/** @param {Array<() => void>} arr */
	function run_all(arr) {
		for (var i = 0; i < arr.length; i++) {
			arr[i]();
		}
	}

	/**
	 * TODO replace with Promise.withResolvers once supported widely enough
	 * @template [T=void]
	 */
	function deferred() {
		/** @type {(value: T) => void} */
		var resolve;

		/** @type {(reason: any) => void} */
		var reject;

		/** @type {Promise<T>} */
		var promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});

		// @ts-expect-error
		return { promise, resolve, reject };
	}

	// General flags
	const DERIVED = 1 << 1;
	const EFFECT = 1 << 2;
	const RENDER_EFFECT = 1 << 3;
	/**
	 * An effect that does not destroy its child effects when it reruns.
	 * Runs as part of render effects, i.e. not eagerly as part of tree traversal or effect flushing.
	 */
	const MANAGED_EFFECT = 1 << 24;
	/**
	 * An effect that does not destroy its child effects when it reruns (like MANAGED_EFFECT).
	 * Runs eagerly as part of tree traversal or effect flushing.
	 */
	const BLOCK_EFFECT = 1 << 4;
	const BRANCH_EFFECT = 1 << 5;
	const ROOT_EFFECT = 1 << 6;
	const BOUNDARY_EFFECT = 1 << 7;
	/**
	 * Set on the effect that `pause_effect` was called on, i.e. the root of a paused subtree,
	 * as opposed to its descendants which are merely `INERT`. This allows `resume_effect` on
	 * an ancestor to skip subtrees that were paused for their own reasons (such as a block
	 * whose condition is still false) rather than resurrecting them
	 */
	const PAUSED = 1 << 8;
	/**
	 * Indicates that a reaction is connected to an effect root — either it is an effect,
	 * or it is a derived that is depended on by at least one effect. If a derived has
	 * no dependents, we can disconnect it from the graph, allowing it to either be
	 * GC'd or reconnected later if an effect comes to depend on it again
	 */
	const CONNECTED = 1 << 9;
	const CLEAN = 1 << 10;
	const DIRTY = 1 << 11;
	const MAYBE_DIRTY = 1 << 12;
	const INERT = 1 << 13;
	const DESTROYED = 1 << 14;
	/** Set once a reaction has run for the first time */
	const REACTION_RAN = 1 << 15;
	/** Effect is in the process of getting destroyed. Can be observed in child teardown functions */
	const DESTROYING = 1 << 25;

	// Flags exclusive to effects
	/**
	 * 'Transparent' effects do not create a transition boundary.
	 * This is on a block effect 99% of the time but may also be on a branch effect if its parent block effect was pruned
	 */
	const EFFECT_TRANSPARENT = 1 << 16;
	const EAGER_EFFECT = 1 << 17;
	const HEAD_EFFECT = 1 << 18;
	const EFFECT_PRESERVED = 1 << 19;
	const USER_EFFECT = 1 << 20;
	const EFFECT_OFFSCREEN = 1 << 25;

	// Flags exclusive to deriveds
	/**
	 * Tells that we marked this derived and its reactions as visited during the "mark as (maybe) dirty"-phase.
	 * Will be lifted during execution of the derived and during checking its dirty state (both are necessary
	 * because a derived might be checked but not executed). This is a pure performance optimization flag and
	 * should not be used for any other purpose!
	 */
	const WAS_MARKED = 1 << 16;

	// Flags used for async
	const REACTION_IS_UPDATING = 1 << 21;
	const ASYNC = 1 << 22;

	const ERROR_VALUE = 1 << 23;

	const STATE_SYMBOL = Symbol('$state');
	/** Marks component export objects, so that `proxy(...)` leaves them untouched */
	const COMPONENT_SYMBOL = Symbol('component');
	const LOADING_ATTR_SYMBOL = Symbol('');
	const ATTRIBUTES_CACHE = Symbol('attributes');
	const CLASS_CACHE = Symbol('class');
	const STYLE_CACHE = Symbol('style');
	const TEXT_CACHE = Symbol('text');
	const FORM_RESET_HANDLER = Symbol('form reset');

	/** allow users to ignore aborted signal errors if `reason.name === 'StaleReactionError` */
	const STALE_REACTION = new (class StaleReactionError extends Error {
		name = 'StaleReactionError';
		message = 'The reaction that called `getAbortSignal()` was re-run or destroyed';
	})();

	const IS_XHTML =
		// We gotta write it like this because after downleveling the pure comment may end up in the wrong location
		!!globalThis.document?.contentType &&
		/* @__PURE__ */ globalThis.document.contentType.includes('xml');

	/* This file is generated by scripts/process-messages/index.js. Do not edit! */


	/**
	 * Reading a derived belonging to a now-destroyed effect may result in stale values
	 */
	function derived_inert() {
		{
			console.warn(`https://svelte.dev/e/derived_inert`);
		}
	}

	/**
	 * A `<svelte:boundary>` `reset` function only resets the boundary the first time it is called
	 */
	function svelte_boundary_reset_noop() {
		{
			console.warn(`https://svelte.dev/e/svelte_boundary_reset_noop`);
		}
	}

	/** @import { Equals } from '#client' */

	/** @type {Equals} */
	function equals(value) {
		return value === this.v;
	}

	/**
	 * @param {unknown} a
	 * @param {unknown} b
	 * @returns {boolean}
	 */
	function safe_not_equal(a, b) {
		return a != a
			? b == b
			: a !== b || (a !== null && typeof a === 'object') || typeof a === 'function';
	}

	/** @type {Equals} */
	function safe_equals(value) {
		return !safe_not_equal(value, this.v);
	}

	/* This file is generated by scripts/process-messages/index.js. Do not edit! */


	/**
	 * Cannot create a `$derived(...)` with an `await` expression outside of an effect tree
	 * @returns {never}
	 */
	function async_derived_orphan() {
		{
			throw new Error(`https://svelte.dev/e/async_derived_orphan`);
		}
	}

	/**
	 * Keyed each block has duplicate key `%value%` at indexes %a% and %b%
	 * @param {string} a
	 * @param {string} b
	 * @param {string | undefined | null} [value]
	 * @returns {never}
	 */
	function each_key_duplicate(a, b, value) {
		{
			throw new Error(`https://svelte.dev/e/each_key_duplicate`);
		}
	}

	/**
	 * `%rune%` cannot be used inside an effect cleanup function
	 * @param {string} rune
	 * @returns {never}
	 */
	function effect_in_teardown(rune) {
		{
			throw new Error(`https://svelte.dev/e/effect_in_teardown`);
		}
	}

	/**
	 * Effect cannot be created inside a `$derived` value that was not itself created inside an effect
	 * @returns {never}
	 */
	function effect_in_unowned_derived() {
		{
			throw new Error(`https://svelte.dev/e/effect_in_unowned_derived`);
		}
	}

	/**
	 * `%rune%` can only be used inside an effect (e.g. during component initialisation)
	 * @param {string} rune
	 * @returns {never}
	 */
	function effect_orphan(rune) {
		{
			throw new Error(`https://svelte.dev/e/effect_orphan`);
		}
	}

	/**
	 * Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state
	 * @returns {never}
	 */
	function effect_update_depth_exceeded() {
		{
			throw new Error(`https://svelte.dev/e/effect_update_depth_exceeded`);
		}
	}

	/**
	 * Property descriptors defined on `$state` objects must contain `value` and always be `enumerable`, `configurable` and `writable`.
	 * @returns {never}
	 */
	function state_descriptors_fixed() {
		{
			throw new Error(`https://svelte.dev/e/state_descriptors_fixed`);
		}
	}

	/**
	 * Cannot set prototype of `$state` object
	 * @returns {never}
	 */
	function state_prototype_fixed() {
		{
			throw new Error(`https://svelte.dev/e/state_prototype_fixed`);
		}
	}

	/**
	 * Updating state inside `$derived(...)`, `$inspect(...)` or a template expression is forbidden. If the value should not be reactive, declare it without `$state`
	 * @returns {never}
	 */
	function state_unsafe_mutation() {
		{
			throw new Error(`https://svelte.dev/e/state_unsafe_mutation`);
		}
	}

	/**
	 * A `<svelte:boundary>` `reset` function cannot be called while an error is still being handled
	 * @returns {never}
	 */
	function svelte_boundary_reset_onerror() {
		{
			throw new Error(`https://svelte.dev/e/svelte_boundary_reset_onerror`);
		}
	}

	/** True if experimental.async=true */
	/** True if $inspect.trace is used */
	let tracing_mode_flag = false;

	/** @import { Snapshot } from './types' */

	/**
	 * In dev, we keep track of which properties could not be cloned. In prod
	 * we don't bother, but we keep a dummy array around so that the
	 * signature stays the same
	 * @type {string[]}
	 */
	const empty = [];

	/**
	 * @template T
	 * @param {T} value
	 * @param {boolean} [skip_warning]
	 * @param {boolean} [no_tojson]
	 * @returns {Snapshot<T>}
	 */
	function snapshot(value, skip_warning = false, no_tojson = false) {

		return clone(value, new Map(), '', empty, null, no_tojson);
	}

	/**
	 * @template T
	 * @param {T} value
	 * @param {Map<T, Snapshot<T>>} cloned
	 * @param {string} path
	 * @param {string[]} paths
	 * @param {null | T} [original] The original value, if `value` was produced from a `toJSON` call
	 * @param {boolean} [no_tojson]
	 * @returns {Snapshot<T>}
	 */
	function clone(value, cloned, path, paths, original = null, no_tojson = false) {
		if (typeof value === 'object' && value !== null) {
			var unwrapped = cloned.get(value);
			if (unwrapped !== undefined) return unwrapped;

			if (value instanceof Map) return /** @type {Snapshot<T>} */ (new Map(value));
			if (value instanceof Set) return /** @type {Snapshot<T>} */ (new Set(value));

			if (is_array(value)) {
				var copy = /** @type {Snapshot<any>} */ (Array(value.length));
				cloned.set(value, copy);

				if (original !== null) {
					cloned.set(original, copy);
				}

				for (var i = 0; i < value.length; i += 1) {
					var element = value[i];
					if (i in value) {
						copy[i] = clone(element, cloned, path, paths, null, no_tojson);
					}
				}

				return copy;
			}

			if (get_prototype_of(value) === object_prototype) {
				/** @type {Snapshot<any>} */
				copy = {};
				cloned.set(value, copy);

				if (original !== null) {
					cloned.set(original, copy);
				}

				for (var key of Object.keys(value)) {
					copy[key] = clone(
						// @ts-expect-error
						value[key],
						cloned,
						path,
						paths,
						null,
						no_tojson
					);
				}

				return copy;
			}

			if (value instanceof Date) {
				// Ensure SvelteDate snapshots are tracked
				value.getTime();
				return /** @type {Snapshot<T>} */ (structuredClone(value));
			}

			if (typeof (/** @type {T & { toJSON?: any } } */ (value).toJSON) === 'function' && !no_tojson) {
				return clone(
					/** @type {T & { toJSON(): any } } */ (value).toJSON(),
					cloned,
					path,
					paths,
					// Associate the instance with the toJSON clone
					value
				);
			}
		}

		if (value instanceof EventTarget) {
			// can't be cloned
			return /** @type {Snapshot<T>} */ (value);
		}

		try {
			return /** @type {Snapshot<T>} */ (structuredClone(value));
		} catch (e) {

			return /** @type {Snapshot<T>} */ (value);
		}
	}

	/** @import { ComponentContext, DevStackEntry, Effect } from '#client' */

	/** @type {ComponentContext | null} */
	let component_context = null;

	/** @param {ComponentContext | null} context */
	function set_component_context(context) {
		component_context = context;
	}

	/**
	 * @param {Record<string, unknown>} props
	 * @param {any} runes
	 * @param {Function} [fn]
	 * @returns {void}
	 */
	function push(props, runes = false, fn) {
		component_context = {
			p: component_context,
			i: false,
			c: null,
			e: null,
			s: props,
			x: null,
			r: /** @type {Effect} */ (active_effect),
			l: null
		};
	}

	/**
	 * @template {Record<string, any>} T
	 * @param {T} [component]
	 * @returns {T}
	 */
	function pop(component) {
		var context = /** @type {ComponentContext} */ (component_context);
		var effects = context.e;

		if (effects !== null) {
			context.e = null;

			for (var fn of effects) {
				create_user_effect(fn);
			}
		}

		context.i = true;

		component_context = context.p;

		return mark_as_component(component);
	}

	/**
	 * Add a symbol to the object (or create one if undefined) to mark it as a component so it isn't proxified.
	 * @param {any} component
	 */
	function mark_as_component(component = {}) {
		define_property(component, COMPONENT_SYMBOL, { value: true });
		return component;
	}

	/** @returns {boolean} */
	function is_runes() {
		return true;
	}

	/** @type {Array<() => void>} */
	let micro_tasks = [];

	function run_micro_tasks() {
		var tasks = micro_tasks;
		micro_tasks = [];
		run_all(tasks);
	}

	/**
	 * @param {() => void} fn
	 */
	function queue_micro_task(fn) {
		if (micro_tasks.length === 0 && !is_flushing_sync) {
			var tasks = micro_tasks;
			queueMicrotask(() => {
				// If this is false, a flushSync happened in the meantime. Do _not_ run new scheduled microtasks in that case
				// as the ordering of microtasks would be broken at that point - consider this case:
				// - queue_micro_task schedules microtask A to flush task X
				// - synchronously after, flushSync runs, processing task X
				// - synchronously after, some other microtask B is scheduled, but not through queue_micro_task but for example a Promise.resolve() in user code
				// - synchronously after, queue_micro_task schedules microtask C to flush task Y
				// - one tick later, microtask A now resolves, flushing task Y before microtask B, which is incorrect
				// This if check prevents that race condition (that realistically will only happen in tests)
				if (tasks === micro_tasks) run_micro_tasks();
			});
		}

		micro_tasks.push(fn);
	}

	/**
	 * Synchronously run any queued tasks.
	 */
	function flush_tasks() {
		while (micro_tasks.length > 0) {
			run_micro_tasks();
		}
	}

	/** @import { Derived, Signal } from '#client' */

	const STATUS_MASK = -7169;

	/**
	 * @param {Signal} signal
	 * @param {number} status
	 */
	function set_signal_status(signal, status) {
		signal.f = (signal.f & STATUS_MASK) | status;
	}

	/**
	 * Set a derived's status to CLEAN or MAYBE_DIRTY based on its connection state.
	 * @param {Derived} derived
	 */
	function update_derived_status(derived) {
		// Only mark as MAYBE_DIRTY if disconnected and has dependencies.
		if ((derived.f & CONNECTED) !== 0 || derived.deps === null) {
			set_signal_status(derived, CLEAN);
		} else {
			set_signal_status(derived, MAYBE_DIRTY);
		}
	}

	/** @import { Derived, Effect, Value } from '#client' */

	/**
	 * @param {Value[] | null} deps
	 */
	function clear_marked(deps) {
		if (deps === null) return;

		for (const dep of deps) {
			if ((dep.f & DERIVED) === 0 || (dep.f & WAS_MARKED) === 0) {
				continue;
			}

			dep.f ^= WAS_MARKED;

			clear_marked(/** @type {Derived} */ (dep).deps);
		}
	}

	/**
	 * @param {Effect} effect
	 * @param {Set<Effect>} dirty_effects
	 * @param {Set<Effect>} maybe_dirty_effects
	 */
	function defer_effect(effect, dirty_effects, maybe_dirty_effects) {
		if ((effect.f & DIRTY) !== 0) {
			dirty_effects.add(effect);
		} else if ((effect.f & MAYBE_DIRTY) !== 0) {
			maybe_dirty_effects.add(effect);
		}

		// Since we're not executing these effects now, we need to clear any WAS_MARKED flags
		// so that other batches can correctly reach these effects during their own traversal
		clear_marked(effect.deps);

		// mark as clean so they get scheduled if they depend on pending async state
		set_signal_status(effect, CLEAN);
	}

	let listening_to_form_reset = false;

	function add_form_reset_listener() {
		if (!listening_to_form_reset) {
			listening_to_form_reset = true;
			document.addEventListener(
				'reset',
				(evt) => {
					// Needs to happen one tick later or else the dom properties of the form
					// elements have not updated to their reset values yet
					Promise.resolve().then(() => {
						if (!evt.defaultPrevented) {
							for (const e of /**@type {HTMLFormElement} */ (evt.target).elements) {
								/** @type {any} */ (e)[FORM_RESET_HANDLER]?.();
							}
						}
					});
				},
				// In the capture phase to guarantee we get noticed of it (no possibility of stopPropagation)
				{ capture: true }
			);
		}
	}

	/**
	 * @template T
	 * @param {() => T} fn
	 */
	function without_reactive_context(fn) {
		var previous_reaction = active_reaction;
		var previous_effect = active_effect;
		set_active_reaction(null);
		set_active_effect(null);
		try {
			return fn();
		} finally {
			set_active_reaction(previous_reaction);
			set_active_effect(previous_effect);
		}
	}

	/**
	 * Listen to the given event, and then instantiate a global form reset listener if not already done,
	 * to notify all bindings when the form is reset
	 * @param {HTMLElement} element
	 * @param {string} event
	 * @param {(is_reset?: true) => void} handler
	 * @param {(is_reset?: true) => void} [on_reset]
	 */
	function listen_to_event_and_reset_event(element, event, handler, on_reset = handler) {
		element.addEventListener(event, () => without_reactive_context(handler));
		const prev = /** @type {any} */ (element)[FORM_RESET_HANDLER];
		if (prev) {
			// special case for checkbox that can have multiple binds (group & checked)
			/** @type {any} */ (element)[FORM_RESET_HANDLER] = () => {
				prev();
				on_reset(true);
			};
		} else {
			/** @type {any} */ (element)[FORM_RESET_HANDLER] = () => on_reset(true);
		}

		add_form_reset_listener();
	}

	/** @import { Blocker, Effect, Source, Value } from '#client' */

	/**
	 * @param {Blocker[]} blockers
	 * @param {Array<() => any>} sync
	 * @param {Array<() => Promise<any>>} async
	 * @param {(values: Value[]) => any} fn
	 */
	function flatten(blockers, sync, async, fn) {
		const d = derived ;

		// Filter out already-settled blockers - no need to wait for them
		var pending = blockers.filter((b) => !b.settled);

		var deriveds = sync.map(d);

		if (async.length === 0 && pending.length === 0) {
			fn(deriveds);
			return;
		}

		var parent = /** @type {Effect} */ (active_effect);

		var restore = capture();
		var blocker_promise =
			pending.length === 1
				? pending[0].promise
				: pending.length > 1
					? Promise.all(pending.map((b) => b.promise))
					: null;

		/**
		 * @param {Source[]} async
		 */
		function finish(async) {
			if ((parent.f & DESTROYED) !== 0) {
				return;
			}

			restore();

			try {
				fn([...deriveds, ...async]);
			} catch (error) {
				invoke_error_boundary(error, parent);
			}

			unset_context();
		}

		var decrement_pending = increment_pending();

		// Fast path: blockers but no async expressions
		if (async.length === 0) {
			/** @type {Promise<any>} */ (blocker_promise).then(() => finish([])).finally(decrement_pending);
			return;
		}

		// Full path: has async expressions
		function run() {
			Promise.all(async.map((expression) => async_derived(expression)))
				.then(finish)
				.catch((error) => invoke_error_boundary(error, parent))
				.finally(decrement_pending);
		}

		if (blocker_promise) {
			blocker_promise.then(() => {
				restore();
				run();
				unset_context();
			});
		} else {
			run();
		}
	}

	/**
	 * Captures the current effect context so that we can restore it after
	 * some asynchronous work has happened (so that e.g. `await a + b`
	 * causes `b` to be registered as a dependency).
	 */
	function capture() {
		var previous_effect = /** @type {Effect} */ (active_effect);
		var previous_reaction = active_reaction;
		var previous_component_context = component_context;
		var previous_batch = /** @type {Batch} */ (current_batch);

		return function restore(activate_batch = true) {
			set_active_effect(previous_effect);
			set_active_reaction(previous_reaction);
			set_component_context(previous_component_context);

			if (activate_batch && (previous_effect.f & DESTROYED) === 0) {
				// TODO we only need optional chaining here because `{#await ...}` blocks
				// are anomalous. Once we retire them we can get rid of it
				previous_batch?.activate();
				previous_batch?.apply();
			}
		};
	}

	function unset_context(deactivate_batch = true) {
		set_active_effect(null);
		set_active_reaction(null);
		set_component_context(null);
		if (deactivate_batch) current_batch?.deactivate();
	}

	/**
	 * @returns {(skip?: boolean) => void}
	 */
	function increment_pending() {
		var effect = /** @type {Effect} */ (active_effect);
		var boundary = effect.b; // undefined if called outside the render tree, e.g. a standalone $effect.root
		var batch = /** @type {Batch} */ (current_batch);
		var blocking = !!boundary?.is_rendered();

		boundary?.update_pending_count(1, batch);
		batch.increment(blocking, effect);

		return () => {
			boundary?.update_pending_count(-1, batch);
			batch.decrement(blocking, effect);
		};
	}

	/** @import { Derived, Effect, Reaction, Source, Value } from '#client' */
	/** @import { Batch } from './batch.js'; */
	/** @import { Boundary } from '../dom/blocks/boundary.js'; */

	/**
	 * @template V
	 * @param {() => V} fn
	 * @returns {Derived<V>}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function derived(fn) {
		var flags = DERIVED | DIRTY;

		if (active_effect !== null) {
			// Since deriveds are evaluated lazily, any effects created inside them are
			// created too late to ensure that the parent effect is added to the tree
			active_effect.f |= EFFECT_PRESERVED;
		}

		/** @type {Derived<V>} */
		const signal = {
			ctx: component_context,
			deps: null,
			effects: null,
			equals,
			f: flags,
			fn,
			reactions: null,
			rv: 0,
			v: /** @type {V} */ (UNINITIALIZED),
			wv: 0,
			parent: active_effect,
			ac: null
		};

		return signal;
	}

	const OBSOLETE = Symbol('obsolete');

	/**
	 * @template V
	 * @param {() => V | Promise<V>} fn
	 * @param {string} [label]
	 * @param {string} [location] If provided, print a warning if the value is not read immediately after update
	 * @returns {Promise<Source<V>>}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function async_derived(fn, label, location) {
		let parent = /** @type {Effect | null} */ (active_effect);

		if (parent === null) {
			async_derived_orphan();
		}

		var promise = /** @type {Promise<V>} */ (/** @type {unknown} */ (undefined));
		var signal = source(/** @type {V} */ (UNINITIALIZED));

		// only suspend in async deriveds created on initialisation
		var should_suspend = !active_reaction;

		/** @type {Set<ReturnType<typeof deferred<V>>>} */
		var deferreds = new Set();

		async_effect(() => {
			var effect = /** @type {Effect} */ (active_effect);

			/** @type {ReturnType<typeof deferred<V>>} */
			var d = deferred();
			promise = d.promise;

			try {
				// If this code is changed at some point, make sure to still access the then property
				// of fn() to read any signals it might access, so that we track them as dependencies.
				// We call `unset_context` to undo any `save` calls that happen inside `fn()`
				Promise.resolve(fn())
					.then(d.resolve, (e) => {
						// if the promise was rejected by the user, via `getAbortSignal`, then
						// wait for a subsequent resolution instead of flushing the batch
						if (e !== STALE_REACTION) d.reject(e);
					})
					.finally(unset_context);
			} catch (error) {
				d.reject(error);
				unset_context();
			}

			var batch = /** @type {Batch} */ (current_batch);

			if (should_suspend) {
				// we only increment the batch's pending state for updates, not creation, otherwise
				// we will decrement to zero before the work that depends on this promise (e.g. a
				// template effect) has initialized, causing the batch to resolve prematurely
				if ((effect.f & REACTION_RAN) !== 0) {
					var decrement_pending = increment_pending();
				}

				if (
					// boundary can be null if the async derived is inside an $effect.root not connected to the component render tree
					parent.b?.is_rendered()
				) {
					batch.async_deriveds.get(effect)?.reject(OBSOLETE);
				} else {
					// While the boundary is still showing pending, a new run supersedes all older in-flight runs
					// for this async expression. Cancel eagerly so resolution cannot commit stale values.
					for (const d of deferreds.values()) {
						d.reject(OBSOLETE);
					}
				}

				deferreds.add(d);
				batch.async_deriveds.set(effect, d);
			}

			/**
			 * @param {any} value
			 * @param {unknown} error
			 */
			const handler = (value, error = undefined) => {

				decrement_pending?.();
				deferreds.delete(d);

				if (error === OBSOLETE) return;

				batch.activate();

				if (error) {
					signal.f |= ERROR_VALUE;

					// @ts-expect-error the error is the wrong type, but we don't care
					internal_set(signal, error);
				} else {
					if ((signal.f & ERROR_VALUE) !== 0) {
						signal.f ^= ERROR_VALUE;
					}

					internal_set(signal, value);
				}

				batch.deactivate();
			};

			d.promise.then(handler, (e) => handler(null, e || 'unknown'));
		});

		teardown(() => {
			for (const d of deferreds) {
				d.reject(OBSOLETE);
			}
		});

		return new Promise((fulfil) => {
			/** @param {Promise<V>} p */
			function next(p) {
				function go() {
					if (p === promise) {
						fulfil(signal);
					} else {
						// if the effect re-runs before the initial promise
						// resolves, delay resolution until we have a value
						next(promise);
					}
				}

				p.then(go, go);
			}

			next(promise);
		});
	}

	/**
	 * @template V
	 * @param {() => V} fn
	 * @returns {Derived<V>}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function user_derived(fn) {
		const d = derived(fn);

		push_reaction_value(d);

		return d;
	}

	/**
	 * @template V
	 * @param {() => V} fn
	 * @returns {Derived<V>}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function derived_safe_equal(fn) {
		const signal = derived(fn);
		signal.equals = safe_equals;
		return signal;
	}

	/**
	 * @param {Derived} derived
	 * @returns {void}
	 */
	function destroy_derived_effects(derived) {
		var effects = derived.effects;

		if (effects !== null) {
			derived.effects = null;

			for (var i = 0; i < effects.length; i += 1) {
				destroy_effect(/** @type {Effect} */ (effects[i]));
			}
		}
	}

	/**
	 * @template T
	 * @param {Derived} derived
	 * @returns {T}
	 */
	function execute_derived(derived) {
		var value;
		var prev_active_effect = active_effect;
		var parent = derived.parent;

		if (
			!is_destroying_effect &&
			parent !== null &&
			derived.v !== UNINITIALIZED && // if it was never evaluated before, it's guaranteed to fail downstream, so we try to execute instead
			(parent.f & (DESTROYED | INERT)) !== 0
		) {
			derived_inert();

			return derived.v;
		}

		set_active_effect(parent);

		{
			try {
				derived.f &= ~WAS_MARKED;
				destroy_derived_effects(derived);
				value = update_reaction(derived);
			} finally {
				set_active_effect(prev_active_effect);
			}
		}

		return value;
	}

	/**
	 * @param {Derived} derived
	 * @returns {void}
	 */
	function update_derived(derived) {
		var value = execute_derived(derived);

		if (!derived.equals(value)) {
			derived.wv = increment_write_version();

			// in a fork, we don't update the underlying value, just `batch_values`.
			// the underlying value will be updated when the fork is committed.
			// otherwise, the next time we get here after a 'real world' state
			// change, `derived.equals` may incorrectly return `true`
			if (!current_batch?.is_fork || derived.deps === null) {
				if (current_batch !== null) {
					// We also write to previous_batch because if it exists, it is a sign that we're
					// currently in the process of flushing effects. These updates to deriveds may belong
					// to the previous batch, not the new one (which can already exist if an earlier
					// effect wrote to a source). This can cause bugs when running batch.#commit() later,
					// but not adding it to current_batch can, too, so we add it to both.
					// See https://github.com/sveltejs/svelte/pull/18117 for more details.
					current_batch.capture(derived, value, true);
					previous_batch?.capture(derived, value, true);
				} else {
					derived.v = value;
				}

				// deriveds without dependencies should never be recomputed
				if (derived.deps === null) {
					set_signal_status(derived, CLEAN);
					return;
				}
			}
		}

		// don't mark derived clean if we're reading it inside a
		// cleanup function, or it will cache a stale value
		if (is_destroying_effect) {
			return;
		}

		// During time traveling we don't want to reset the status so that
		// traversal of the graph in the other batches still happens
		if (batch_values !== null) {
			// only cache the value if we're in a tracking context, otherwise we won't
			// clear the cache in `mark_reactions` when dependencies are updated
			if (effect_tracking() || current_batch?.is_fork) {
				batch_values.set(derived, value);
			}
		} else {
			update_derived_status(derived);
		}
	}

	/**
	 * @param {Derived} derived
	 */
	function freeze_derived_effects(derived) {
		if (derived.effects === null) return;

		for (const e of derived.effects) {
			// if the effect has a teardown function or abort signal, call it
			if (e.teardown || e.ac) {
				e.teardown?.();
				if (e.ac !== null) {
					without_reactive_context(() => {
						/** @type {AbortController} */ (e.ac).abort(STALE_REACTION);
						e.ac = null;
					});
				}

				// make it a noop so it doesn't get called again if the derived
				// is unfrozen. we don't set it to `null`, because the existence
				// of a teardown function is what determines whether the
				// effect runs again during unfreezing (but not for teardown-only effects)
				if (e.fn !== null) e.teardown = noop;

				remove_reactions(e, 0);
				destroy_effect_children(e);
			}
		}
	}

	/**
	 * @param {Derived} derived
	 */
	function unfreeze_derived_effects(derived) {
		if (derived.effects === null) return;

		for (const e of derived.effects) {
			// if the effect was previously frozen — indicated by the presence
			// of a teardown function — unfreeze it
			if (e.teardown && e.fn !== null) {
				update_effect(e);
			}
		}
	}

	/** @import { Fork } from 'svelte' */
	/** @import { Derived, Effect, Reaction, Source, Value } from '#client' */

	/** @type {Batch | null} */
	let first_batch = null;

	/** @type {Batch | null} */
	let last_batch = null;

	/** @type {Batch | null} */
	let current_batch = null;

	/**
	 * This is needed to avoid overwriting inputs
	 * @type {Batch | null}
	 */
	let previous_batch = null;

	/**
	 * When time travelling (i.e. working in one batch, while other batches
	 * still have ongoing work), we ignore the real values of affected
	 * signals in favour of their values within the batch
	 * @type {Map<Value, any> | null}
	 */
	let batch_values = null;

	/** @type {Effect | null} */
	let last_scheduled_effect = null;

	let is_flushing_sync = false;
	let is_processing = false;

	/**
	 * During traversal, this is an array. Newly created effects are (if not immediately
	 * executed) pushed to this array, rather than going through the scheduling
	 * rigamarole that would cause another turn of the flush loop.
	 * @type {Effect[] | null}
	 */
	let collected_effects = null;

	/**
	 * An array of effects that are marked during traversal as a result of a `set`
	 * (not `internal_set`) call. These will be added to the next batch and
	 * trigger another `batch.process()`
	 * @type {Effect[] | null}
	 * @deprecated when we get rid of legacy mode and stores, we can get rid of this
	 */
	let legacy_updates = null;

	var flush_count = 0;

	let uid = 1;

	class Batch {
		id = uid++;

		/** True as soon as `#process` was called */
		#started = false;

		linked = true;

		/** @type {Batch | null} */
		#prev = null;

		/** @type {Batch | null} */
		#next = null;

		/** @type {Map<Effect, ReturnType<typeof deferred<any>>>} */
		async_deriveds = new Map();

		/**
		 * The current values of any signals that are updated in this batch.
		 * Tuple format: [value, is_derived] (note: is_derived is false for deriveds, too, if they were overridden via assignment)
		 * They keys of this map are identical to `this.#previous`
		 * @type {Map<Value, [any, boolean]>}
		 */
		current = new Map();

		/**
		 * The values of any signals (sources and deriveds) that are updated in this batch _before_ those updates took place.
		 * They keys of this map are identical to `this.#current`
		 * @type {Map<Value, any>}
		 */
		previous = new Map();

		/**
		 * When the batch is committed (and the DOM is updated), we need to remove old branches
		 * and append new ones by calling the functions added inside (if/each/key/etc) blocks
		 * @type {Set<(batch: Batch) => void>}
		 */
		#commit_callbacks = new Set();

		/**
		 * If a fork is discarded, we need to destroy any effects that are no longer needed
		 * @type {Set<(batch: Batch) => void>}
		 */
		#discard_callbacks = new Set();

		/**
		 * The number of async effects that are currently in flight
		 */
		#pending = 0;

		/**
		 * Async effects that are currently in flight, _not_ inside a pending boundary
		 * @type {Map<Effect, number>}
		 */
		#blocking_pending = new Map();

		/**
		 * A deferred that resolves when the batch is committed, used with `settled()`
		 * TODO replace with Promise.withResolvers once supported widely enough
		 * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
		 */
		#deferred = null;

		/**
		 * The root effects that need to be flushed
		 * @type {Effect[]}
		 */
		#roots = [];

		/**
		 * Effects created while this batch was active.
		 * @type {Effect[]}
		 */
		#new_effects = [];

		/**
		 * Deferred effects (which run after async work has completed) that are DIRTY
		 * @type {Set<Effect>}
		 */
		#dirty_effects = new Set();

		/**
		 * Deferred effects that are MAYBE_DIRTY
		 * @type {Set<Effect>}
		 */
		#maybe_dirty_effects = new Set();

		/**
		 * A map of branches that still exist, but will be destroyed when this batch
		 * is committed — we skip over these during `process`.
		 * The value contains child effects that were dirty/maybe_dirty before being reset,
		 * so they can be rescheduled if the branch survives.
		 * @type {Map<Effect, { d: Effect[], m: Effect[] }>}
		 */
		#skipped_branches = new Map();

		/**
		 * Inverse of #skipped_branches which we need to tell prior batches to unskip them when committing
		 * @type {Set<Effect>}
		 */
		#unskipped_branches = new Set();

		is_fork = false;

		#decrement_queued = false;

		constructor() {
			// link batch
			if (last_batch === null) {
				first_batch = last_batch = this;
			} else {
				last_batch.#next = this;
				this.#prev = last_batch;
			}

			last_batch = this;
		}

		#is_deferred() {
			if (this.is_fork) return true;

			for (const effect of this.#blocking_pending.keys()) {
				var e = effect;
				var skipped = false;

				while (e.parent !== null) {
					if (this.#skipped_branches.has(e)) {
						skipped = true;
						break;
					}

					e = e.parent;
				}

				if (!skipped) {
					return true;
				}
			}

			return false;
		}

		/**
		 * Add an effect to the #skipped_branches map and reset its children
		 * @param {Effect} effect
		 */
		skip_effect(effect) {
			if (!this.#skipped_branches.has(effect)) {
				this.#skipped_branches.set(effect, { d: [], m: [] });
			}
			this.#unskipped_branches.delete(effect);
		}

		/**
		 * Remove an effect from the #skipped_branches map and reschedule
		 * any tracked dirty/maybe_dirty child effects
		 * @param {Effect} effect
		 * @param {(e: Effect) => void} callback
		 */
		unskip_effect(effect, callback = (e) => this.schedule(e)) {
			var tracked = this.#skipped_branches.get(effect);
			if (tracked) {
				this.#skipped_branches.delete(effect);

				for (var e of tracked.d) {
					set_signal_status(e, DIRTY);
					callback(e);
				}

				for (e of tracked.m) {
					set_signal_status(e, MAYBE_DIRTY);
					callback(e);
				}
			}
			this.#unskipped_branches.add(effect);
		}

		#process() {
			this.#started = true;

			if (flush_count++ > 1000) {
				this.#unlink();
				infinite_loop_guard();
			}

			// We always reschedule previously-deferred effects, not just when
			// #is_deferred() is true, because traversing the tree could make
			// an if block that contains the last blocking pending effect falsy,
			// causing the block to no longer be deferred.
			for (const e of this.#dirty_effects) {
				this.#maybe_dirty_effects.delete(e);
				set_signal_status(e, DIRTY);
				this.schedule(e);
			}

			for (const e of this.#maybe_dirty_effects) {
				set_signal_status(e, MAYBE_DIRTY);
				this.schedule(e);
			}

			const roots = this.#roots;
			this.#roots = [];

			this.apply();

			/** @type {Effect[]} */
			var effects = (collected_effects = []);

			/** @type {Effect[]} */
			var render_effects = [];

			/**
			 * @type {Effect[]}
			 * @deprecated when we get rid of legacy mode and stores, we can get rid of this
			 */
			var updates = (legacy_updates = []);

			for (const root of roots) {
				try {
					this.#traverse(root, effects, render_effects);
				} catch (e) {
					reset_all(root);
					// If there's no async work left, this branch is now dead and needs
					// to be discarded to not become a zombie that is never cleaned up.
					// See https://github.com/sveltejs/svelte/issues/18221#issuecomment-4497918414
					// for a (non-minimal) reproduction that demonstrates a case where this is necessary
					// to not get follow-up false-positives via "batch has scheduled roots" invariant errors.
					if (!this.#is_deferred()) this.discard();
					throw e;
				}
			}

			// any writes should take effect in a subsequent batch
			current_batch = null;

			if (updates.length > 0) {
				var batch = Batch.ensure();
				for (const e of updates) {
					batch.schedule(e);
				}
			}

			collected_effects = null;
			legacy_updates = null;

			// if the batch has outstanding pending work, stash effects and bail
			if (this.#is_deferred()) {
				this.#defer_effects(render_effects);
				this.#defer_effects(effects);

				for (const [e, t] of this.#skipped_branches) {
					reset_branch(e, t);
				}

				if (updates.length > 0) {
					/** @type {Batch} */ (/** @type {unknown} */ (current_batch)).#process();
				}

				return;
			}

			const earlier_batch = this.#find_earlier_batch();

			if (earlier_batch) {
				// If this batch collected deferred effects during traversal, they still need
				// to run after being merged into the earlier batch.
				this.#defer_effects(render_effects);
				this.#defer_effects(effects);
				earlier_batch.#merge(this);
				return;
			}

			// clear effects. Those that are still needed will be rescheduled through unskipping the skipped branches.
			this.#dirty_effects.clear();
			this.#maybe_dirty_effects.clear();

			// append/remove branches
			for (const fn of this.#commit_callbacks) fn(this);
			this.#commit_callbacks.clear();

			previous_batch = this;
			flush_queued_effects(render_effects);
			flush_queued_effects(effects);
			previous_batch = null;

			this.#deferred?.resolve();

			var next_batch = /** @type {Batch | null} */ (/** @type {unknown} */ (current_batch));

			if (this.#pending === 0 && (this.#roots.length === 0 || next_batch !== null)) {
				this.#unlink();
			}

			// Edge case: During traversal new branches might create effects that run immediately and set state,
			// causing an effect and therefore a root to be scheduled again. We need to traverse the current batch
			// once more in that case - most of the time this will just clean up dirty branches.
			if (this.#roots.length > 0) {
				if (next_batch !== null) {
					const batch = next_batch;
					batch.#roots.push(...this.#roots.filter((r) => !batch.#roots.includes(r)));
				} else {
					next_batch = this;
				}
			}

			if (next_batch !== null) {
				old_values.clear();
				next_batch.#process();
			}
		}

		/**
		 * Traverse the effect tree, executing effects or stashing
		 * them for later execution as appropriate
		 * @param {Effect} root
		 * @param {Effect[]} effects
		 * @param {Effect[]} render_effects
		 */
		#traverse(root, effects, render_effects) {
			root.f ^= CLEAN;

			var effect = root.first;

			while (effect !== null) {
				var flags = effect.f;
				var is_branch = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) !== 0;
				var is_skippable_branch = is_branch && (flags & CLEAN) !== 0;

				var skip = is_skippable_branch || (flags & INERT) !== 0 || this.#skipped_branches.has(effect);

				if (!skip && effect.fn !== null) {
					if (is_branch) {
						effect.f ^= CLEAN;
					} else if ((flags & EFFECT) !== 0) {
						effects.push(effect);
					} else if (is_dirty(effect)) {
						if ((flags & BLOCK_EFFECT) !== 0) this.#maybe_dirty_effects.add(effect);
						update_effect(effect);
					}

					var child = effect.first;

					if (child !== null) {
						effect = child;
						continue;
					}
				}

				while (effect !== null) {
					var next = effect.next;

					if (next !== null) {
						effect = next;
						break;
					}

					effect = effect.parent;
				}
			}
		}

		#find_earlier_batch() {
			var batch = this.#prev;

			while (batch !== null) {
				if (!batch.is_fork) {
					// if the batches are connected, break
					for (const [value, [, is_derived]] of this.current) {
						if (batch.current.has(value) && !is_derived) {
							return batch;
						}
					}
				}

				batch = batch.#prev;
			}

			return null;
		}

		/**
		 * @param {Batch} batch
		 */
		#merge(batch) {
			for (const [source, value] of batch.current) {
				if (!this.previous.has(source) && batch.previous.has(source)) {
					this.previous.set(source, batch.previous.get(source));
				}

				this.current.set(source, value);
			}

			for (const [effect, deferred] of batch.async_deriveds) {
				const d = this.async_deriveds.get(effect);
				if (d) deferred.promise.then(d.resolve).catch(d.reject);
			}

			// Clear them or else those that are still pending might get rejected on discard (after merged-into batch is done).
			// This can happen when batch Y merged into X and Y has a pending boundary and therefore still-pending async deriveds inside.
			batch.async_deriveds.clear();

			// Mark is not guaranteed not touch these, so we transfer them
			this.transfer_effects(batch.#dirty_effects, batch.#maybe_dirty_effects);

			/**
			 * mark all effects that depend on `batch.current`, except the
			 * async effects that we just resolved (TODO unless they depend
			 * on values in this batch that are NOT in the later batch?).
			 * Through this we also will populate the correct #skipped_branches,
			 * oncommit callbacks etc, so we don't need to merge them separately.
			 * @param {Value} value
			 */
			const mark = (value) => {
				var reactions = value.reactions;
				if (reactions === null) return;
				// skip if value is derived and is neither dirty nor maybe dirty. transitive
				// deriveds (a derived depending on another derived) are only MAYBE_DIRTY, so
				// we must continue traversing them to reach the effects that depend on them
				if ((value.f & DERIVED) !== 0 && (value.f & (DIRTY | MAYBE_DIRTY)) === 0) {
					return;
				}

				for (const reaction of reactions) {
					var flags = reaction.f;

					if ((flags & DERIVED) !== 0) {
						mark(/** @type {Derived} */ (reaction));
					} else {
						var effect = /** @type {Effect} */ (reaction);

						if (flags & (ASYNC | BLOCK_EFFECT) && !this.async_deriveds.has(effect)) {
							this.#maybe_dirty_effects.delete(effect);
							set_signal_status(effect, DIRTY);
							this.schedule(effect);
						}
					}
				}
			};

			for (const source of this.current.keys()) {
				mark(source);
			}

			this.oncommit(() => batch.discard());
			batch.#unlink();

			current_batch = this;
			this.#process();
		}

		/**
		 * @param {Effect[]} effects
		 */
		#defer_effects(effects) {
			for (var i = 0; i < effects.length; i += 1) {
				defer_effect(effects[i], this.#dirty_effects, this.#maybe_dirty_effects);
			}
		}

		/**
		 * Associate a change to a given source with the current
		 * batch, noting its previous and current values
		 * @param {Value} source
		 * @param {any} value
		 * @param {boolean} [is_derived]
		 */
		capture(source, value, is_derived = false) {
			if (source.v !== UNINITIALIZED && !this.previous.has(source)) {
				this.previous.set(source, source.v);
			}

			// Don't save errors in `batch_values`, or they won't be thrown in `runtime.js#get`
			if ((source.f & ERROR_VALUE) === 0) {
				this.current.set(source, [value, is_derived]);
				batch_values?.set(source, value);
			}

			if (!this.is_fork) {
				source.v = value;
			}
		}

		activate() {
			current_batch = this;
		}

		deactivate() {
			current_batch = null;
			batch_values = null;
		}

		flush() {
			try {
				if (DEV) ;

				is_processing = true;
				current_batch = this;

				this.#process();
			} finally {
				flush_count = 0;
				last_scheduled_effect = null;
				collected_effects = null;
				legacy_updates = null;
				is_processing = false;

				current_batch = null;
				batch_values = null;

				old_values.clear();
			}
		}

		discard() {
			for (const fn of this.#discard_callbacks) fn(this);
			this.#discard_callbacks.clear();

			for (const deferred of this.async_deriveds.values()) {
				deferred.reject(OBSOLETE);
			}

			this.#unlink();
			this.#deferred?.resolve();
		}

		/**
		 * @param {Effect} effect
		 */
		register_created_effect(effect) {
			this.#new_effects.push(effect);
		}

		#commit() {
			// If there are other pending batches, they now need to be 'rebased' —
			// in other words, we re-run block/async effects with the newly
			// committed state, unless the batch in question has a more
			// recent value for a given source
			for (let batch = first_batch; batch !== null; batch = batch.#next) {
				var is_earlier = batch.id < this.id;

				/** @type {Source[]} */
				var sources = [];

				for (const [source, [value, is_derived]] of this.current) {
					if (batch.current.has(source)) {
						var batch_value = /** @type {[any, boolean]} */ (batch.current.get(source))[0]; // faster than destructuring

						if (is_earlier && value !== batch_value) {
							// bring the value up to date
							batch.current.set(source, [value, is_derived]);
						} else {
							// same value or later batch has more recent value,
							// no need to re-run these effects
							continue;
						}
					}

					sources.push(source);
				}

				if (is_earlier) {
					// TODO do we need to restart these in some cases, instead of
					// immediately resolving them? Likely not because of how this.apply() works.
					for (const [effect, deferred] of this.async_deriveds) {
						const d = batch.async_deriveds.get(effect);
						if (d) deferred.promise.then(d.resolve).catch(d.reject);
					}
				}

				var current = [...batch.current.keys()].filter(
					(source) => !(/** @type {[any, boolean]} */ (batch.current.get(source))[1])
				);

				// If not started yet or no sources to update (which is e.g. possible for the very first batch) then bail
				if (!batch.#started || current.length === 0) continue;

				// Re-run async/block effects that depend on distinct values changed in both batches (ignoring deriveds)
				var others = current.filter((source) => !this.current.has(source));

				if (others.length === 0) {
					if (is_earlier) {
						// this batch is now obsolete and can be discarded
						batch.discard();
					}
				} else if (sources.length > 0) {

					// A batch was unskipped in a later batch -> tell prior batches to unskip it, too
					if (is_earlier) {
						for (const unskipped of this.#unskipped_branches) {
							batch.unskip_effect(unskipped, (e) => {
								if ((e.f & (BLOCK_EFFECT | ASYNC)) !== 0) {
									batch.schedule(e);
								} else {
									batch.#defer_effects([e]);
								}
							});
						}
					}

					batch.activate();

					/** @type {Set<Value>} */
					var marked = new Set();

					/** @type {Map<Reaction, boolean>} */
					var checked = new Map();

					for (var source of sources) {
						mark_effects(source, others, marked, checked);
					}

					checked = new Map();
					var current_unequal = [...batch.current]
						.filter(([c, v1]) => {
							const v2 = this.current.get(c);
							if (!v2) return true;
							// Either their values are different or one is a derived but not the other
							return v2[0] !== v1[0] || v2[1] !== v1[1];
						})
						.map(([c]) => c);

					if (current_unequal.length > 0) {
						for (const effect of this.#new_effects) {
							if (
								(effect.f & (DESTROYED | INERT | EAGER_EFFECT)) === 0 &&
								depends_on(effect, current_unequal, checked)
							) {
								if ((effect.f & (ASYNC | BLOCK_EFFECT)) !== 0) {
									set_signal_status(effect, DIRTY);
									batch.schedule(effect);
								} else {
									batch.#dirty_effects.add(effect);
								}
							}
						}
					}

					// Only apply and traverse when we know we triggered async work with marking the effects
					// and know this won't run anyway right afterwards
					if (batch.#roots.length > 0 && !batch.#decrement_queued) {
						batch.apply();

						for (var root of batch.#roots) {
							batch.#traverse(root, [], []);
						}

						batch.#roots = [];
					}

					batch.deactivate();
				}
			}
		}

		/**
		 * @param {boolean} blocking
		 * @param {Effect} effect
		 */
		increment(blocking, effect) {
			this.#pending += 1;

			if (blocking) {
				let blocking_pending_count = this.#blocking_pending.get(effect) ?? 0;
				this.#blocking_pending.set(effect, blocking_pending_count + 1);
			}
		}

		/**
		 * @param {boolean} blocking
		 * @param {Effect} effect
		 */
		decrement(blocking, effect) {
			this.#pending -= 1;

			if (blocking) {
				let blocking_pending_count = this.#blocking_pending.get(effect) ?? 0;

				if (blocking_pending_count === 1) {
					this.#blocking_pending.delete(effect);
				} else {
					this.#blocking_pending.set(effect, blocking_pending_count - 1);
				}
			}

			if (this.#decrement_queued) return;
			this.#decrement_queued = true;

			queue_micro_task(() => {
				this.#decrement_queued = false;

				if (this.linked) {
					this.flush();
				}
			});
		}

		/**
		 * @param {Set<Effect>} dirty_effects
		 * @param {Set<Effect>} maybe_dirty_effects
		 */
		transfer_effects(dirty_effects, maybe_dirty_effects) {
			for (const e of dirty_effects) {
				this.#dirty_effects.add(e);
			}

			for (const e of maybe_dirty_effects) {
				this.#maybe_dirty_effects.add(e);
			}

			dirty_effects.clear();
			maybe_dirty_effects.clear();
		}

		/** @param {(batch: Batch) => void} fn */
		oncommit(fn) {
			this.#commit_callbacks.add(fn);
		}

		/** @param {(batch: Batch) => void} fn */
		ondiscard(fn) {
			this.#discard_callbacks.add(fn);
		}

		settled() {
			return (this.#deferred ??= deferred()).promise;
		}

		static ensure() {
			if (current_batch === null) {
				const batch = (current_batch = new Batch());

				if (!is_processing && !is_flushing_sync) {
					queue_micro_task(() => {
						if (!batch.#started) {
							batch.flush();
						}
					});
				}
			}

			return current_batch;
		}

		apply() {
			{
				batch_values = null;
				return;
			}
		}

		/**
		 *
		 * @param {Effect} effect
		 */
		schedule(effect) {
			last_scheduled_effect = effect;

			// defer render effects inside a pending boundary
			// TODO the `REACTION_RAN` check is only necessary because of legacy `$:` effects AFAICT — we can remove later
			if (
				effect.b?.is_pending &&
				(effect.f & (EFFECT | RENDER_EFFECT | MANAGED_EFFECT)) !== 0 &&
				(effect.f & REACTION_RAN) === 0
			) {
				effect.b.defer_effect(effect);
				return;
			}

			var e = effect;

			while (e.parent !== null) {
				e = e.parent;
				var flags = e.f;

				// if the effect is being scheduled because a parent (each/await/etc) block
				// updated an internal source, or because a branch is being unskipped,
				// bail out or we'll cause a second flush
				if (collected_effects !== null && e === active_effect) {

					// in sync mode, render effects run during traversal. in an extreme edge case
					// — namely that we're setting a value inside a derived read during traversal —
					// they can be made dirty after they have already been visited, in which
					// case we shouldn't bail out. we also shouldn't bail out if we're
					// updating a store inside a `$:`, since this might invalidate
					// effects that were already visited
					if (
						(active_reaction === null || (active_reaction.f & DERIVED) === 0) &&
						true
					) {
						return;
					}
				}

				if ((flags & (ROOT_EFFECT | BRANCH_EFFECT)) !== 0) {
					if ((flags & CLEAN) === 0) {
						// branch is already dirty, bail
						return;
					}

					e.f ^= CLEAN;
				}
			}

			this.#roots.push(e);
		}

		#unlink() {
			// #merge calls #unlink, discard later on does it again - prevent
			// running it multiple times to not corrupt the linked list
			if (!this.linked) return;

			var prev = this.#prev;
			var next = this.#next;

			if (prev === null) {
				first_batch = next;
			} else {
				prev.#next = next;
			}

			if (next === null) {
				last_batch = prev;
			} else {
				next.#prev = prev;
			}

			this.linked = false;
		}
	}

	// TODO Svelte@6 think about removing the callback argument.
	/**
	 * Synchronously flush any pending updates.
	 * Returns void if no callback is provided, otherwise returns the result of calling the callback.
	 * @template [T=void]
	 * @param {(() => T) | undefined} [fn]
	 * @returns {T}
	 */
	function flushSync(fn) {
		var was_flushing_sync = is_flushing_sync;
		is_flushing_sync = true;

		try {
			var result;

			if (fn) ;

			while (true) {
				flush_tasks();

				if (current_batch === null) {
					return /** @type {T} */ (result);
				}

				current_batch.flush();
			}
		} finally {
			is_flushing_sync = was_flushing_sync;
		}
	}

	function infinite_loop_guard() {

		try {
			effect_update_depth_exceeded();
		} catch (error) {

			// Best effort: invoke the boundary nearest the most recent
			// effect and hope that it's relevant to the infinite loop
			invoke_error_boundary(error, last_scheduled_effect);
		}
	}

	/** @type {Set<Effect> | null} */
	let eager_block_effects = null;

	/**
	 * @param {Array<Effect>} effects
	 * @returns {void}
	 */
	function flush_queued_effects(effects) {
		var length = effects.length;
		if (length === 0) return;

		var i = 0;

		while (i < length) {
			var effect = effects[i++];

			if ((effect.f & (DESTROYED | INERT)) === 0 && is_dirty(effect)) {
				eager_block_effects = new Set();

				update_effect(effect);

				// Effects with no dependencies or teardown do not get added to the effect tree.
				// Deferred effects (e.g. `$effect(...)`) _are_ added to the tree because we
				// don't know if we need to keep them until they are executed. Doing the check
				// here (rather than in `update_effect`) allows us to skip the work for
				// immediate effects.
				if (
					effect.deps === null &&
					effect.first === null &&
					effect.nodes === null &&
					effect.teardown === null &&
					effect.ac === null
				) {
					// remove this effect from the graph
					unlink_effect(effect);
				}

				// If update_effect() has a flushSync() in it, we may have flushed another flush_queued_effects(),
				// which already handled this logic and did set eager_block_effects to null.
				if (eager_block_effects?.size > 0) {
					old_values.clear();

					for (const e of eager_block_effects) {
						// Skip eager effects that have already been unmounted
						if ((e.f & (DESTROYED | INERT)) !== 0) continue;

						// Run effects in order from ancestor to descendant, else we could run into nullpointers
						/** @type {Effect[]} */
						const ordered_effects = [e];
						let ancestor = e.parent;
						while (ancestor !== null) {
							if (eager_block_effects.has(ancestor)) {
								eager_block_effects.delete(ancestor);
								ordered_effects.push(ancestor);
							}
							ancestor = ancestor.parent;
						}

						for (let j = ordered_effects.length - 1; j >= 0; j--) {
							const e = ordered_effects[j];
							// Skip eager effects that have already been unmounted
							if ((e.f & (DESTROYED | INERT)) !== 0) continue;
							update_effect(e);
						}
					}

					eager_block_effects.clear();
				}
			}
		}

		eager_block_effects = null;
	}

	/**
	 * This is similar to `mark_reactions`, but it only marks async/block effects
	 * depending on `value` and at least one of the other `sources`, so that
	 * these effects can re-run after another batch has been committed
	 * @param {Value} value
	 * @param {Source[]} sources
	 * @param {Set<Value>} marked
	 * @param {Map<Reaction, boolean>} checked
	 */
	function mark_effects(value, sources, marked, checked) {
		if (marked.has(value)) return;
		marked.add(value);

		if (value.reactions !== null) {
			for (const reaction of value.reactions) {
				const flags = reaction.f;

				if ((flags & DERIVED) !== 0) {
					mark_effects(/** @type {Derived} */ (reaction), sources, marked, checked);
				} else if (
					(flags & (ASYNC | BLOCK_EFFECT)) !== 0 &&
					(flags & DIRTY) === 0 &&
					depends_on(reaction, sources, checked)
				) {
					set_signal_status(reaction, DIRTY);
					schedule_effect(/** @type {Effect} */ (reaction));
				}
			}
		}
	}

	/**
	 * @param {Reaction} reaction
	 * @param {Source[]} sources
	 * @param {Map<Reaction, boolean>} checked
	 */
	function depends_on(reaction, sources, checked) {
		const depends = checked.get(reaction);
		if (depends !== undefined) return depends;

		if (reaction.deps !== null) {
			for (const dep of reaction.deps) {
				if (includes.call(sources, dep)) {
					return true;
				}

				if ((dep.f & DERIVED) !== 0 && depends_on(/** @type {Derived} */ (dep), sources, checked)) {
					checked.set(/** @type {Derived} */ (dep), true);
					return true;
				}
			}
		}

		checked.set(reaction, false);

		return false;
	}

	/**
	 * @param {Effect} effect
	 * @returns {void}
	 */
	function schedule_effect(effect) {
		/** @type {Batch} */ (current_batch).schedule(effect);
	}

	/**
	 * Mark all the effects inside a skipped branch CLEAN, so that
	 * they can be correctly rescheduled later. Tracks dirty and maybe_dirty
	 * effects so they can be rescheduled if the branch survives.
	 * @param {Effect} effect
	 * @param {{ d: Effect[], m: Effect[] }} tracked
	 */
	function reset_branch(effect, tracked) {
		// clean branch = nothing dirty inside, no need to traverse further
		if ((effect.f & BRANCH_EFFECT) !== 0 && (effect.f & CLEAN) !== 0) {
			return;
		}

		if ((effect.f & DIRTY) !== 0) {
			tracked.d.push(effect);
		} else if ((effect.f & MAYBE_DIRTY) !== 0) {
			tracked.m.push(effect);
		}

		set_signal_status(effect, CLEAN);

		var e = effect.first;
		while (e !== null) {
			reset_branch(e, tracked);
			e = e.next;
		}
	}

	/**
	 * Mark an entire effect tree clean following an error
	 * @param {Effect} effect
	 */
	function reset_all(effect) {
		set_signal_status(effect, CLEAN);

		var e = effect.first;
		while (e !== null) {
			reset_all(e);
			e = e.next;
		}
	}

	/** @import { Derived, Effect, Source, Value } from '#client' */

	/** @type {Set<Effect>} */
	let eager_effects = new Set();

	/** @type {Map<Source, any>} */
	const old_values = new Map();

	let eager_effects_deferred = false;

	/**
	 * @template V
	 * @param {V} v
	 * @param {Error | null} [stack]
	 * @returns {Source<V>}
	 */
	// TODO rename this to `state` throughout the codebase
	function source(v, stack) {
		/** @type {Value} */
		var signal = {
			f: 0, // TODO ideally we could skip this altogether, but it causes type errors
			v,
			reactions: null,
			equals,
			rv: 0,
			wv: 0
		};

		return signal;
	}

	/**
	 * @template V
	 * @param {V} v
	 * @param {Error | null} [stack]
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function state(v, stack) {
		const s = source(v);

		push_reaction_value(s);

		return s;
	}

	/**
	 * @template V
	 * @param {V} initial_value
	 * @param {boolean} [immutable]
	 * @returns {Source<V>}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function mutable_source(initial_value, immutable = false, trackable = true) {
		const s = source(initial_value);
		if (!immutable) {
			s.equals = safe_equals;
		}

		return s;
	}

	/**
	 * @template V
	 * @param {Source<V>} source
	 * @param {V} value
	 * @param {boolean} [should_proxy]
	 * @returns {V}
	 */
	function set(source, value, should_proxy = false) {
		if (
			active_reaction !== null &&
			// since we are untracking the function inside `$inspect.with` we need to add this check
			// to ensure we error if state is set inside an inspect effect
			(!untracking || (active_reaction.f & EAGER_EFFECT) !== 0) &&
			is_runes() &&
			(active_reaction.f & (DERIVED | BLOCK_EFFECT | ASYNC | EAGER_EFFECT)) !== 0 &&
			(current_sources === null || !current_sources.has(source))
		) {
			state_unsafe_mutation();
		}

		let new_value = should_proxy ? proxy(value) : value;

		return internal_set(source, new_value, legacy_updates);
	}

	/**
	 * @template V
	 * @param {Source<V>} source
	 * @param {V} value
	 * @param {Effect[] | null} [updated_during_traversal]
	 * @returns {V}
	 */
	function internal_set(source, value, updated_during_traversal = null) {
		if (!source.equals(value)) {
			if (is_destroying_effect) {
				old_values.set(source, value);
			} else if (!old_values.has(source)) {
				// only record the value from before the first write in this flush, otherwise a
				// teardown would see the value from before whichever write happened to be last
				old_values.set(source, source.v);
			}

			var batch = Batch.ensure();
			batch.capture(source, value);

			if ((source.f & DERIVED) !== 0) {
				const derived = /** @type {Derived} */ (source);

				// if we are assigning to a dirty derived we set it to clean/maybe dirty but we also eagerly execute it to track the dependencies
				if ((source.f & DIRTY) !== 0) {
					execute_derived(derived);
				}

				// During time traveling we don't want to reset the status so that
				// traversal of the graph in the other batches still happens
				if (batch_values === null) {
					update_derived_status(derived);
				}
			}

			source.wv = increment_write_version();

			// For debugging, in case you want to know which reactions are being scheduled:
			// log_reactions(source);
			mark_reactions(source, DIRTY, updated_during_traversal);

			// It's possible that the current reaction might not have up-to-date dependencies
			// whilst it's actively running. So in the case of ensuring it registers the reaction
			// properly for itself, we need to ensure the current effect actually gets
			// scheduled. i.e: `$effect(() => x++)`
			if (
				active_effect !== null &&
				(active_effect.f & CLEAN) !== 0 &&
				(active_effect.f & (BRANCH_EFFECT | ROOT_EFFECT)) === 0
			) {
				if (untracked_writes === null) {
					set_untracked_writes([source]);
				} else {
					untracked_writes.push(source);
				}
			}

			if (!batch.is_fork && eager_effects.size > 0 && !eager_effects_deferred) {
				flush_eager_effects();
			}
		}

		return value;
	}

	function flush_eager_effects() {
		eager_effects_deferred = false;

		for (const effect of eager_effects) {
			// Mark clean inspect-effects as maybe dirty and then check their dirtiness
			// instead of just updating the effects - this way we avoid overfiring.
			if ((effect.f & CLEAN) !== 0) {
				set_signal_status(effect, MAYBE_DIRTY);
			}

			let dirty;

			try {
				dirty = is_dirty(effect);
			} catch {
				// Dirty-checking can evaluate derived dependencies and throw in cases where
				// parent effects are about to destroy this eager effect. Run the effect so
				// its own error handling can deal with transient failures.
				dirty = true;
			}

			if (dirty) {
				update_effect(effect);
			}
		}

		eager_effects.clear();
	}

	/**
	 * Silently (without using `get`) increment a source
	 * @param {Source<number>} source
	 */
	function increment(source) {
		set(source, source.v + 1);
	}

	/**
	 * @param {Value} signal
	 * @param {number} status should be DIRTY or MAYBE_DIRTY
	 * @param {Effect[] | null} updated_during_traversal
	 * @returns {void}
	 */
	function mark_reactions(signal, status, updated_during_traversal) {
		var reactions = signal.reactions;
		if (reactions === null) return;
		var length = reactions.length;

		for (var i = 0; i < length; i++) {
			var reaction = reactions[i];
			var flags = reaction.f;

			var not_dirty = (flags & DIRTY) === 0;

			// don't set a DIRTY reaction to MAYBE_DIRTY
			if (not_dirty) {
				set_signal_status(reaction, status);
			}

			if ((flags & EAGER_EFFECT) !== 0) {
				// Eager effects need to run immediately:
				// - for $inspect so that the stack trace makes sense
				// - for $state.eager because they might be without an effect parent
				eager_effects.add(/** @type {Effect} */ (reaction));
			} else if ((flags & DERIVED) !== 0) {
				var derived = /** @type {Derived} */ (reaction);

				batch_values?.delete(derived);

				if ((flags & WAS_MARKED) === 0) {
					// Only connected deriveds being executed outside the update cycle can be reliably unmarked right away
					if (
						flags & CONNECTED &&
						(active_effect === null || (active_effect.f & REACTION_IS_UPDATING) === 0)
					) {
						reaction.f |= WAS_MARKED;
					}

					mark_reactions(derived, MAYBE_DIRTY, updated_during_traversal);
				}
			} else if (not_dirty) {
				var effect = /** @type {Effect} */ (reaction);

				if ((flags & BLOCK_EFFECT) !== 0 && eager_block_effects !== null) {
					eager_block_effects.add(effect);
				}

				if (updated_during_traversal !== null) {
					updated_during_traversal.push(effect);
				} else {
					schedule_effect(effect);
				}
			}
		}
	}

	/** @import { Source } from '#client' */

	/**
	 * @template T
	 * @param {T} value
	 * @returns {T}
	 */
	function proxy(value) {
		// if non-proxyable, a component instance, or already a proxy, return `value`
		if (
			typeof value !== 'object' ||
			value === null ||
			STATE_SYMBOL in value ||
			COMPONENT_SYMBOL in value
		) {
			return value;
		}

		const prototype = get_prototype_of(value);

		if (prototype !== object_prototype && prototype !== array_prototype) {
			return value;
		}

		/** @type {Map<any, Source<any>>} */
		var sources = new Map();
		var is_proxied_array = is_array(value);
		var version = state(0);
		var parent_version = update_version;

		/**
		 * Executes the proxy in the context of the reaction it was originally created in, if any
		 * @template T
		 * @param {() => T} fn
		 */
		var with_parent = (fn) => {
			if (update_version === parent_version) {
				return fn();
			}

			// child source is being created after the initial proxy —
			// prevent it from being associated with the current reaction
			var reaction = active_reaction;
			var version = update_version;

			set_active_reaction(null);
			set_update_version(parent_version);

			var result = fn();

			set_active_reaction(reaction);
			set_update_version(version);

			return result;
		};

		if (is_proxied_array) {
			// We need to create the length source eagerly to ensure that
			// mutations to the array are properly synced with our proxy
			sources.set('length', state(/** @type {any[]} */ (value).length));
		}

		return new Proxy(/** @type {any} */ (value), {
			defineProperty(_, prop, descriptor) {
				if (
					!('value' in descriptor) ||
					descriptor.configurable === false ||
					descriptor.enumerable === false ||
					descriptor.writable === false
				) {
					// we disallow non-basic descriptors, because unless they are applied to the
					// target object — which we avoid, so that state can be forked — we will run
					// afoul of the various invariants
					// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/getOwnPropertyDescriptor#invariants
					state_descriptors_fixed();
				}
				var s = sources.get(prop);
				if (s === undefined) {
					with_parent(() => {
						var s = state(descriptor.value);
						sources.set(prop, s);
						return s;
					});
				} else {
					set(s, descriptor.value, true);
				}

				return true;
			},

			deleteProperty(target, prop) {
				var s = sources.get(prop);

				if (s === undefined) {
					if (prop in target) {
						const s = with_parent(() => state(UNINITIALIZED));
						sources.set(prop, s);
						increment(version);
					}
				} else {
					set(s, UNINITIALIZED);
					increment(version);
				}

				return true;
			},

			get(target, prop, receiver) {
				if (prop === STATE_SYMBOL) {
					return value;
				}

				var s = sources.get(prop);
				var exists = prop in target;

				// create a source, but only if it's an own property and not a prototype property
				if (s === undefined && (!exists || get_descriptor(target, prop)?.writable)) {
					s = with_parent(() => {
						var p = proxy(exists ? target[prop] : UNINITIALIZED);
						var s = state(p);

						return s;
					});

					sources.set(prop, s);
				}

				if (s !== undefined) {
					var v = get(s);
					return v === UNINITIALIZED ? undefined : v;
				}

				return Reflect.get(target, prop, receiver);
			},

			getOwnPropertyDescriptor(target, prop) {
				var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

				if (descriptor && 'value' in descriptor) {
					var s = sources.get(prop);
					if (s) descriptor.value = get(s);
				} else if (descriptor === undefined) {
					var source = sources.get(prop);
					var value = source?.v;

					if (source !== undefined && value !== UNINITIALIZED) {
						return {
							enumerable: true,
							configurable: true,
							value,
							writable: true
						};
					}
				}

				return descriptor;
			},

			has(target, prop) {
				if (prop === STATE_SYMBOL) {
					return true;
				}

				var s = sources.get(prop);
				var has = (s !== undefined && s.v !== UNINITIALIZED) || Reflect.has(target, prop);

				if (
					s !== undefined ||
					(active_effect !== null && (!has || get_descriptor(target, prop)?.writable))
				) {
					if (s === undefined) {
						s = with_parent(() => {
							var p = has ? proxy(target[prop]) : UNINITIALIZED;
							var s = state(p);

							return s;
						});

						sources.set(prop, s);
					}

					var value = get(s);
					if (value === UNINITIALIZED) {
						return false;
					}
				}

				return has;
			},

			set(target, prop, value, receiver) {
				var s = sources.get(prop);
				var has = prop in target;

				// variable.length = value -> clear all signals with index >= value
				if (is_proxied_array && prop === 'length') {
					for (var i = value; i < /** @type {Source<number>} */ (s).v; i += 1) {
						var other_s = sources.get(i + '');
						if (other_s !== undefined) {
							set(other_s, UNINITIALIZED);
						} else if (i in target) {
							// If the item exists in the original, we need to create an uninitialized source,
							// else a later read of the property would result in a source being created with
							// the value of the original item at that index.
							other_s = with_parent(() => state(UNINITIALIZED));
							sources.set(i + '', other_s);
						}
					}
				}

				// If we haven't yet created a source for this property, we need to ensure
				// we do so otherwise if we read it later, then the write won't be tracked and
				// the heuristics of effects will be different vs if we had read the proxied
				// object property before writing to that property.
				if (s === undefined) {
					if (!has || get_descriptor(target, prop)?.writable) {
						s = with_parent(() => state(undefined));
						set(s, proxy(value));

						sources.set(prop, s);
					}
				} else {
					has = s.v !== UNINITIALIZED;

					var p = with_parent(() => proxy(value));
					set(s, p);
				}

				var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

				// Set the new value before updating any signals so that any listeners get the new value
				if (descriptor?.set) {
					descriptor.set.call(receiver, value);
				}

				if (!has) {
					// If we have mutated an array directly, we might need to
					// signal that length has also changed. Do it before updating metadata
					// to ensure that iterating over the array as a result of a metadata update
					// will not cause the length to be out of sync.
					if (is_proxied_array && typeof prop === 'string') {
						var ls = /** @type {Source<number>} */ (sources.get('length'));
						var n = Number(prop);

						if (Number.isInteger(n) && n >= ls.v) {
							set(ls, n + 1);
						}
					}

					increment(version);
				}

				return true;
			},

			ownKeys(target) {
				get(version);

				var own_keys = Reflect.ownKeys(target).filter((key) => {
					var source = sources.get(key);
					return source === undefined || source.v !== UNINITIALIZED;
				});

				for (var [key, source] of sources) {
					if (source.v !== UNINITIALIZED && !(key in target)) {
						own_keys.push(key);
					}
				}

				return own_keys;
			},

			setPrototypeOf() {
				state_prototype_fixed();
			}
		});
	}

	/** @import { Effect, TemplateNode } from '#client' */

	// export these for reference in the compiled code, making global name deduplication unnecessary
	/** @type {Window} */
	var $window;

	/** @type {boolean} */
	var is_firefox;

	/** @type {() => Node | null} */
	var first_child_getter;
	/** @type {() => Node | null} */
	var next_sibling_getter;

	/**
	 * Initialize these lazily to avoid issues when using the runtime in a server context
	 * where these globals are not available while avoiding a separate server entry point
	 */
	function init_operations() {
		if ($window !== undefined) {
			return;
		}

		$window = window;
		is_firefox = /Firefox/.test(navigator.userAgent);

		var element_prototype = Element.prototype;
		var node_prototype = Node.prototype;
		var text_prototype = Text.prototype;

		// @ts-ignore
		first_child_getter = get_descriptor(node_prototype, 'firstChild').get;
		// @ts-ignore
		next_sibling_getter = get_descriptor(node_prototype, 'nextSibling').get;

		if (is_extensible(element_prototype)) {
			// the following assignments improve perf of lookups on DOM nodes
			/** @type {any} */ (element_prototype)[CLASS_CACHE] = undefined;
			/** @type {any} */ (element_prototype)[ATTRIBUTES_CACHE] = null;
			/** @type {any} */ (element_prototype)[STYLE_CACHE] = undefined;
			// @ts-expect-error
			element_prototype.__e = undefined;
		}

		if (is_extensible(text_prototype)) {
			/** @type {any} */ (text_prototype)[TEXT_CACHE] = undefined;
		}
	}

	/**
	 * @param {string} value
	 * @returns {Text}
	 */
	function create_text(value = '') {
		return document.createTextNode(value);
	}

	/**
	 * @template {Node} N
	 * @param {N} node
	 */
	/*@__NO_SIDE_EFFECTS__*/
	function get_first_child(node) {
		return /** @type {TemplateNode | null} */ (first_child_getter.call(node));
	}

	/**
	 * @template {Node} N
	 * @param {N} node
	 */
	/*@__NO_SIDE_EFFECTS__*/
	function get_next_sibling(node) {
		return /** @type {TemplateNode | null} */ (next_sibling_getter.call(node));
	}

	/**
	 * Don't mark this as side-effect-free, hydration needs to walk all nodes
	 * @template {Node} N
	 * @param {N} node
	 * @param {boolean} is_text
	 * @returns {TemplateNode | null}
	 */
	function child(node, is_text) {
		{
			return get_first_child(node);
		}
	}

	/**
	 * Don't mark this as side-effect-free, hydration needs to walk all nodes
	 * @param {TemplateNode} node
	 * @param {boolean} [is_text]
	 * @returns {TemplateNode | null}
	 */
	function first_child(node, is_text = false) {
		{
			var first = get_first_child(node);

			// TODO prevent user comments with the empty string when preserveComments is true
			if (first instanceof Comment && first.data === '') return get_next_sibling(first);

			return first;
		}
	}

	/**
	 * `child`, for the very common case of an element with exactly one child. Resetting the
	 * hydration cursor is part of the same step, so the compiler doesn't have to emit a
	 * separate `reset` call for every `<p>{text}</p>` in an app.
	 * Don't mark this as side-effect-free, hydration needs to walk all nodes
	 * @param {TemplateNode} node
	 * @param {boolean} [is_text]
	 * @returns {TemplateNode | null}
	 */
	function only_child(node, is_text = false) {
		{
			return get_first_child(node);
		}
	}

	/**
	 * Don't mark this as side-effect-free, hydration needs to walk all nodes
	 * @param {TemplateNode} node
	 * @param {number} count
	 * @param {boolean} is_text
	 * @returns {TemplateNode | null}
	 */
	function sibling(node, count = 1, is_text = false) {
		let next_sibling = node;

		while (count--) {
			next_sibling = /** @type {TemplateNode} */ (get_next_sibling(next_sibling));
		}

		{
			return next_sibling;
		}
	}

	/**
	 * @template {Node} N
	 * @param {N} node
	 * @returns {void}
	 */
	function clear_text_content(node) {
		node.textContent = '';
	}

	/**
	 * Branching here is intentional and load-bearing for perf. `createElement(tag)`
	 * hits a fast path in Blink that `createElementNS(NAMESPACE_HTML, tag)` doesn't,
	 * and passing an explicit `undefined` as the trailing options arg measurably
	 * slows both APIs. Funnelling every case through a single `createElementNS(ns,
	 * tag, options)` call would be smaller but slower on the HTML path.
	 *
	 * @template {keyof HTMLElementTagNameMap | string} T
	 * @param {T} tag
	 * @param {string} [namespace]
	 * @param {string} [is]
	 * @returns {T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : Element}
	 */
	function create_element(tag, namespace, is) {
		{
			return /** @type {T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : Element} */ (
				is ? document.createElement(tag, { is }) : document.createElement(tag)
			);
		}
	}

	/** @import { Derived, Effect } from '#client' */
	/** @import { Boundary } from './dom/blocks/boundary.js' */

	/**
	 * @param {unknown} error
	 */
	function handle_error(error) {
		var effect = active_effect;

		// for unowned deriveds, don't throw until we read the value
		if (effect === null) {
			/** @type {Derived} */ (active_reaction).f |= ERROR_VALUE;
			return error;
		}

		// if the error occurred while creating this subtree, we let it
		// bubble up until it hits a boundary that can handle it, unless
		// it's an $effect in which case it doesn't run immediately
		if ((effect.f & REACTION_RAN) === 0 && (effect.f & EFFECT) === 0) {

			throw error;
		}

		// otherwise we bubble up the effect tree ourselves
		invoke_error_boundary(error, effect);
	}

	/**
	 * @param {unknown} error
	 * @param {Effect | null} effect
	 */
	function invoke_error_boundary(error, effect) {
		if (effect !== null && (effect.f & DESTROYED) !== 0) {
			return;
		}

		while (effect !== null) {
			// Skip boundaries that are destroyed/destroying and cannot meaningfully handle the error.
			if ((effect.f & BOUNDARY_EFFECT) !== 0 && (effect.f & (DESTROYED | DESTROYING)) === 0) {
				if ((effect.f & REACTION_RAN) === 0) {
					// we are still creating the boundary effect
					throw error;
				}

				try {
					/** @type {Boundary} */ (effect.b).error(error);
					return;
				} catch (e) {
					error = e;
				}
			}

			effect = effect.parent;
		}

		throw error;
	}

	/** @import { Blocker, ComponentContext, ComponentContextLegacy, Derived, Effect, TemplateNode, TransitionManager } from '#client' */

	/**
	 * @param {'$effect' | '$effect.pre' | '$inspect'} rune
	 */
	function validate_effect(rune) {
		if (active_effect === null) {
			if (active_reaction === null) {
				effect_orphan();
			}

			effect_in_unowned_derived();
		}

		if (is_destroying_effect) {
			effect_in_teardown();
		}
	}

	/**
	 * @param {Effect} effect
	 * @param {Effect} parent_effect
	 */
	function push_effect(effect, parent_effect) {
		var parent_last = parent_effect.last;
		if (parent_last === null) {
			parent_effect.last = parent_effect.first = effect;
		} else {
			parent_last.next = effect;
			effect.prev = parent_last;
			parent_effect.last = effect;
		}
	}

	/**
	 * @param {number} type
	 * @param {null | (() => void | (() => void))} fn
	 * @returns {Effect}
	 */
	function create_effect(type, fn) {
		var parent = active_effect;

		if (parent !== null && (parent.f & INERT) !== 0) {
			type |= INERT;
		}

		/** @type {Effect} */
		var effect = {
			ctx: component_context,
			deps: null,
			nodes: null,
			f: type | DIRTY | CONNECTED,
			first: null,
			fn,
			last: null,
			next: null,
			parent,
			b: parent && parent.b,
			prev: null,
			teardown: null,
			wv: 0,
			ac: null
		};

		current_batch?.register_created_effect(effect);

		/** @type {Effect | null} */
		var e = effect;

		if ((type & EFFECT) !== 0) {
			if (collected_effects !== null) {
				// created during traversal — collect and run afterwards
				collected_effects.push(effect);
			} else {
				// schedule for later
				Batch.ensure().schedule(effect);
			}
		} else if (fn !== null) {
			try {
				update_effect(effect);
			} catch (e) {
				destroy_effect(effect);
				throw e;
			}

			// if an effect doesn't need to be kept in the tree (because it
			// won't re-run, has no DOM, and has no teardown etc)
			// then we skip it and go to its child (if any)
			if (
				e.deps === null &&
				e.teardown === null &&
				e.nodes === null &&
				e.first === e.last && // either `null`, or a singular child
				(e.f & EFFECT_PRESERVED) === 0
			) {
				e = e.first;
				if ((type & BLOCK_EFFECT) !== 0 && (type & EFFECT_TRANSPARENT) !== 0 && e !== null) {
					e.f |= EFFECT_TRANSPARENT;
				}
			}
		}

		if (e !== null) {
			e.parent = parent;

			if (parent !== null) {
				push_effect(e, parent);
			}

			// if we're in a derived, add the effect there too
			if (
				active_reaction !== null &&
				(active_reaction.f & DERIVED) !== 0 &&
				(type & ROOT_EFFECT) === 0
			) {
				var derived = /** @type {Derived} */ (active_reaction);
				(derived.effects ??= []).push(e);
			}
		}

		return effect;
	}

	/**
	 * Internal representation of `$effect.tracking()`
	 * @returns {boolean}
	 */
	function effect_tracking() {
		return active_reaction !== null && !untracking;
	}

	/**
	 * @param {() => void} fn
	 */
	function teardown(fn) {
		const effect = create_effect(RENDER_EFFECT, null);
		set_signal_status(effect, CLEAN);
		effect.teardown = fn;
		return effect;
	}

	/**
	 * Internal representation of `$effect(...)`
	 * @param {() => void | (() => void)} fn
	 */
	function user_effect(fn) {
		validate_effect();

		// Non-nested `$effect(...)` in a component should be deferred
		// until the component is mounted
		var flags = /** @type {Effect} */ (active_effect).f;
		var defer =
			!active_reaction &&
			(flags & BRANCH_EFFECT) !== 0 &&
			component_context !== null &&
			!component_context.i;

		if (defer) {
			// Top-level `$effect(...)` in an unmounted component — defer until mount
			var context = /** @type {ComponentContext} */ (component_context);
			(context.e ??= []).push(fn);
		} else {
			// Everything else — create immediately
			return create_user_effect(fn);
		}
	}

	/**
	 * @param {() => void | (() => void)} fn
	 */
	function create_user_effect(fn) {
		return create_effect(EFFECT | USER_EFFECT, fn);
	}

	/**
	 * Internal representation of `$effect.root(...)`
	 * @param {() => void | (() => void)} fn
	 * @returns {() => void}
	 */
	function effect_root(fn) {
		Batch.ensure();
		const effect = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn);

		return () => {
			destroy_effect(effect);
		};
	}

	/**
	 * An effect root whose children can transition out
	 * @param {() => void} fn
	 * @returns {(options?: { outro?: boolean }) => Promise<void>}
	 */
	function component_root(fn) {
		Batch.ensure();
		const effect = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn);

		return (options = {}) => {
			return new Promise((fulfil) => {
				if (options.outro) {
					pause_effect(effect, () => {
						destroy_effect(effect);
						fulfil(undefined);
					});
				} else {
					destroy_effect(effect);
					fulfil(undefined);
				}
			});
		};
	}

	/**
	 * @param {() => void | (() => void)} fn
	 * @returns {Effect}
	 */
	function effect(fn) {
		return create_effect(EFFECT, fn);
	}

	/**
	 * @param {() => void | (() => void)} fn
	 * @returns {Effect}
	 */
	function async_effect(fn) {
		return create_effect(ASYNC | EFFECT_PRESERVED, fn);
	}

	/**
	 * @param {() => void | (() => void)} fn
	 * @returns {Effect}
	 */
	function render_effect(fn, flags = 0) {
		return create_effect(RENDER_EFFECT | flags, fn);
	}

	/**
	 * @param {(...expressions: any) => void | (() => void)} fn
	 * @param {Array<() => any>} sync
	 * @param {Array<() => Promise<any>>} async
	 * @param {Blocker[]} blockers
	 */
	function template_effect(fn, sync = [], async = [], blockers = []) {
		flatten(blockers, sync, async, (values) => {
			create_effect(RENDER_EFFECT, () => {
				fn(...values.map(get));
			});
		});
	}

	/**
	 * @param {(() => void)} fn
	 * @param {number} flags
	 */
	function block(fn, flags = 0) {
		var effect = create_effect(BLOCK_EFFECT | flags, fn);
		return effect;
	}

	/**
	 * @param {(() => void)} fn
	 */
	function branch(fn) {
		return create_effect(BRANCH_EFFECT | EFFECT_PRESERVED, fn);
	}

	/**
	 * @param {Effect} effect
	 */
	function execute_effect_teardown(effect) {
		var teardown = effect.teardown;
		if (teardown !== null) {
			const previously_destroying_effect = is_destroying_effect;
			const previous_reaction = active_reaction;
			set_is_destroying_effect(true);
			set_active_reaction(null);
			try {
				teardown.call(null);
			} catch (error) {
				// Route teardown errors through the boundary system so that a live
				// ancestor <svelte:boundary> can handle them. Boundaries that are
				// themselves mid-teardown are skipped by invoke_error_boundary.
				invoke_error_boundary(error, effect.parent);
			} finally {
				set_is_destroying_effect(previously_destroying_effect);
				set_active_reaction(previous_reaction);
			}
		}
	}

	/**
	 * @param {Effect} signal
	 * @param {boolean} remove_dom
	 * @returns {void}
	 */
	function destroy_effect_children(signal, remove_dom = false) {
		var effect = signal.first;
		signal.first = signal.last = null;

		while (effect !== null) {
			const controller = effect.ac;

			if (controller !== null) {
				without_reactive_context(() => {
					controller.abort(STALE_REACTION);
				});
			}

			var next = effect.next;

			if ((effect.f & ROOT_EFFECT) !== 0) {
				// this is now an independent root
				effect.parent = null;
			} else {
				destroy_effect(effect, remove_dom);
			}

			effect = next;
		}
	}

	/**
	 * @param {Effect} signal
	 * @returns {void}
	 */
	function destroy_block_effect_children(signal) {
		var effect = signal.first;

		while (effect !== null) {
			var next = effect.next;
			if ((effect.f & BRANCH_EFFECT) === 0) {
				destroy_effect(effect);
			}
			effect = next;
		}
	}

	/**
	 * @param {Effect} effect
	 * @param {boolean} [remove_dom]
	 * @returns {void}
	 */
	function destroy_effect(effect, remove_dom = true) {
		var removed = false;

		if (
			(remove_dom || (effect.f & HEAD_EFFECT) !== 0) &&
			effect.nodes !== null &&
			effect.nodes.end !== null
		) {
			remove_effect_dom(effect.nodes.start, /** @type {TemplateNode} */ (effect.nodes.end));
			removed = true;
		}

		effect.f |= DESTROYING;
		destroy_effect_children(effect, remove_dom && !removed);
		remove_reactions(effect, 0);

		var transitions = effect.nodes && effect.nodes.t;

		if (transitions !== null) {
			for (const transition of transitions) {
				transition.stop();
			}
		}

		execute_effect_teardown(effect);

		effect.f ^= DESTROYING;
		effect.f |= DESTROYED;

		var parent = effect.parent;

		// If the parent doesn't have any children, then skip this work altogether
		if (parent !== null && parent.first !== null) {
			unlink_effect(effect);
		}

		// `first` and `child` are nulled out in destroy_effect_children
		// we don't null out `parent` so that error propagation can work correctly
		effect.next =
			effect.prev =
			effect.teardown =
			effect.ctx =
			effect.deps =
			effect.fn =
			effect.nodes =
			effect.ac =
			effect.b =
				null;
	}

	/**
	 *
	 * @param {TemplateNode | null} node
	 * @param {TemplateNode} end
	 */
	function remove_effect_dom(node, end) {
		while (node !== null) {
			/** @type {TemplateNode | null} */
			var next = node === end ? null : get_next_sibling(node);

			node.remove();
			node = next;
		}
	}

	/**
	 * Detach an effect from the effect tree, freeing up memory and
	 * reducing the amount of work that happens on subsequent traversals
	 * @param {Effect} effect
	 */
	function unlink_effect(effect) {
		var parent = effect.parent;
		var prev = effect.prev;
		var next = effect.next;

		if (prev !== null) prev.next = next;
		if (next !== null) next.prev = prev;

		if (parent !== null) {
			if (parent.first === effect) parent.first = next;
			if (parent.last === effect) parent.last = prev;
		}
	}

	/**
	 * When a block effect is removed, we don't immediately destroy it or yank it
	 * out of the DOM, because it might have transitions. Instead, we 'pause' it.
	 * It stays around (in memory, and in the DOM) until outro transitions have
	 * completed, and if the state change is reversed then we _resume_ it.
	 * A paused effect does not update, and the DOM subtree becomes inert.
	 * @param {Effect} effect
	 * @param {() => void} [callback]
	 * @param {boolean} [destroy]
	 */
	function pause_effect(effect, callback, destroy = true) {
		/** @type {TransitionManager[]} */
		var transitions = [];

		effect.f |= PAUSED;
		pause_children(effect, transitions, true);

		var fn = () => {
			if (destroy) destroy_effect(effect);
			if (callback) callback();
		};

		var remaining = transitions.length;
		if (remaining > 0) {
			var check = () => --remaining || fn();
			for (var transition of transitions) {
				transition.out(check);
			}
		} else {
			fn();
		}
	}

	/**
	 * @param {Effect} effect
	 * @param {TransitionManager[]} transitions
	 * @param {boolean} local
	 */
	function pause_children(effect, transitions, local) {
		if ((effect.f & INERT) !== 0) return;
		effect.f ^= INERT;

		var t = effect.nodes && effect.nodes.t;

		if (t !== null) {
			for (const transition of t) {
				if (transition.is_global || local) {
					transitions.push(transition);
				}
			}
		}

		var child = effect.first;

		while (child !== null) {
			var sibling = child.next;

			// If this child is a root effect, then it will become an independent root when its parent
			// is destroyed, it should therefore not become inert nor partake in transitions.
			if ((child.f & ROOT_EFFECT) === 0) {
				var transparent =
					(child.f & EFFECT_TRANSPARENT) !== 0 ||
					// If this is a branch effect without a block effect parent,
					// it means the parent block effect was pruned. In that case,
					// transparency information was transferred to the branch effect.
					((child.f & BRANCH_EFFECT) !== 0 && (effect.f & BLOCK_EFFECT) !== 0);
				// TODO we don't need to call pause_children recursively with a linked list in place
				// it's slightly more involved though as we have to account for `transparent` changing
				// through the tree.
				pause_children(child, transitions, transparent ? local : false);
			}

			child = sibling;
		}
	}

	/**
	 * The opposite of `pause_effect`. We call this if (for example)
	 * `x` becomes falsy then truthy: `{#if x}...{/if}`
	 * @param {Effect} effect
	 */
	function resume_effect(effect) {
		effect.f &= ~PAUSED;
		resume_children(effect, true);
	}

	/**
	 * @param {Effect} effect
	 * @param {boolean} local
	 */
	function resume_children(effect, local) {
		// this subtree was paused for its own reasons (e.g. a block whose condition
		// is still false) — its controller will resume or destroy it
		if ((effect.f & PAUSED) !== 0) return;

		if ((effect.f & INERT) === 0) return;
		effect.f ^= INERT;

		// If a dependency of this effect changed while it was paused,
		// schedule the effect to update. we don't use `is_dirty`
		// here because we don't want to eagerly recompute a derived like
		// `{#if foo}{foo.bar()}{/if}` if `foo` is now `undefined
		if ((effect.f & CLEAN) === 0) {
			set_signal_status(effect, DIRTY);
			Batch.ensure().schedule(effect); // Assumption: This happens during the commit phase of the batch, causing another flush, but it's safe
		}

		var child = effect.first;

		while (child !== null) {
			var sibling = child.next;
			var transparent = (child.f & EFFECT_TRANSPARENT) !== 0 || (child.f & BRANCH_EFFECT) !== 0;
			// TODO we don't need to call resume_children recursively with a linked list in place
			// it's slightly more involved though as we have to account for `transparent` changing
			// through the tree.
			resume_children(child, transparent ? local : false);
			child = sibling;
		}

		var t = effect.nodes && effect.nodes.t;

		if (t !== null) {
			for (const transition of t) {
				if (transition.is_global || local) {
					transition.in();
				}
			}
		}
	}

	/**
	 * @param {Effect} effect
	 * @param {DocumentFragment} fragment
	 */
	function move_effect(effect, fragment) {
		if (!effect.nodes) return;

		/** @type {TemplateNode | null} */
		var node = effect.nodes.start;
		var end = effect.nodes.end;

		while (node !== null) {
			/** @type {TemplateNode | null} */
			var next = node === end ? null : get_next_sibling(node);

			fragment.append(node);
			node = next;
		}
	}

	/** @import { Derived, Effect, Reaction, Source, Value } from '#client' */

	/**
	 * True if updating in an effect context that is reactive (i.e. not branch/root effects)
	 */
	let is_updating_effect = false;

	let is_destroying_effect = false;

	/** @param {boolean} value */
	function set_is_destroying_effect(value) {
		is_destroying_effect = value;
	}

	/** @type {null | Reaction} */
	let active_reaction = null;

	let untracking = false;

	/** @param {null | Reaction} reaction */
	function set_active_reaction(reaction) {
		active_reaction = reaction;
	}

	/** @type {null | Effect} */
	let active_effect = null;

	/** @param {null | Effect} effect */
	function set_active_effect(effect) {
		active_effect = effect;
	}

	/**
	 * When sources are created within a reaction, reading and writing
	 * them within that reaction should not cause a re-run
	 * @type {null | Set<Source>}
	 */
	let current_sources = null;

	/** @param {Value} value */
	function push_reaction_value(value) {
		if (active_reaction !== null && (true)) {
			(current_sources ??= new Set()).add(value);
		}
	}

	/**
	 * The dependencies of the reaction that is currently being executed. In many cases,
	 * the dependencies are unchanged between runs, and so this will be `null` unless
	 * and until a new dependency is accessed — we track this via `skipped_deps`
	 * @type {null | Value[]}
	 */
	let new_deps = null;

	let skipped_deps = 0;

	/**
	 * Tracks writes that the effect it's executed in doesn't listen to yet,
	 * so that the dependency can be added to the effect later on if it then reads it
	 * @type {null | Source[]}
	 */
	let untracked_writes = null;

	/** @param {null | Source[]} value */
	function set_untracked_writes(value) {
		untracked_writes = value;
	}

	/**
	 * @type {number} Used by sources and deriveds for handling updates.
	 * Version starts from 1 so that unowned deriveds differentiate between a created effect and a run one for tracing
	 **/
	let write_version = 1;

	/** @type {number} Used to version each read of a source of derived to avoid duplicating dependencies inside a reaction */
	let read_version = 0;

	let update_version = read_version;

	/** @param {number} value */
	function set_update_version(value) {
		update_version = value;
	}

	function increment_write_version() {
		return ++write_version;
	}

	/**
	 * Determines whether a derived or effect is dirty.
	 * If it is MAYBE_DIRTY, will set the status to CLEAN
	 * @param {Reaction} reaction
	 * @returns {boolean}
	 */
	function is_dirty(reaction) {
		var flags = reaction.f;

		if ((flags & DIRTY) !== 0) {
			return true;
		}

		if (flags & DERIVED) {
			reaction.f &= ~WAS_MARKED;
		}

		if ((flags & MAYBE_DIRTY) !== 0) {
			var dependencies = /** @type {Value[]} */ (reaction.deps);
			var length = dependencies.length;

			for (var i = 0; i < length; i++) {
				var dependency = dependencies[i];

				if (is_dirty(/** @type {Derived} */ (dependency))) {
					update_derived(/** @type {Derived} */ (dependency));
				}

				if (dependency.wv > reaction.wv) {
					return true;
				}
			}

			if (
				(flags & CONNECTED) !== 0 &&
				// During time traveling we don't want to reset the status so that
				// traversal of the graph in the other batches still happens
				batch_values === null
			) {
				set_signal_status(reaction, CLEAN);
			}
		}

		return false;
	}

	/**
	 * @param {Value} signal
	 * @param {Effect} effect
	 * @param {boolean} [root]
	 */
	function schedule_possible_effect_self_invalidation(signal, effect, root = true) {
		var reactions = signal.reactions;
		if (reactions === null) return;

		if (current_sources !== null && current_sources.has(signal)) {
			return;
		}

		for (var i = 0; i < reactions.length; i++) {
			var reaction = reactions[i];

			if ((reaction.f & DERIVED) !== 0) {
				schedule_possible_effect_self_invalidation(/** @type {Derived} */ (reaction), effect, false);
			} else if (effect === reaction) {
				if (root) {
					set_signal_status(reaction, DIRTY);
				} else if ((reaction.f & CLEAN) !== 0) {
					set_signal_status(reaction, MAYBE_DIRTY);
				}
				schedule_effect(/** @type {Effect} */ (reaction));
			}
		}
	}

	/** @param {Reaction} reaction */
	function update_reaction(reaction) {
		var previous_deps = new_deps;
		var previous_skipped_deps = skipped_deps;
		var previous_untracked_writes = untracked_writes;
		var previous_reaction = active_reaction;
		var previous_sources = current_sources;
		var previous_component_context = component_context;
		var previous_untracking = untracking;
		var previous_update_version = update_version;

		var flags = reaction.f;

		new_deps = /** @type {null | Value[]} */ (null);
		skipped_deps = 0;
		untracked_writes = null;
		active_reaction = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) === 0 ? reaction : null;

		current_sources = null;
		set_component_context(reaction.ctx);
		untracking = false;
		update_version = ++read_version;

		if (reaction.ac !== null) {
			without_reactive_context(() => {
				/** @type {AbortController} */ (reaction.ac).abort(STALE_REACTION);
			});

			reaction.ac = null;
		}

		try {
			reaction.f |= REACTION_IS_UPDATING;
			var fn = /** @type {Function} */ (reaction.fn);
			var result = fn();
			reaction.f |= REACTION_RAN;
			var deps = update_dependencies(reaction);

			// If we're inside an effect and we have untracked writes, then we need to
			// ensure that if any of those untracked writes result in re-invalidation
			// of the current effect, then that happens accordingly
			if (
				is_runes() &&
				untracked_writes !== null &&
				!untracking &&
				deps !== null &&
				(reaction.f & (DERIVED | MAYBE_DIRTY | DIRTY)) === 0
			) {
				for (var i = 0; i < /** @type {Source[]} */ (untracked_writes).length; i++) {
					schedule_possible_effect_self_invalidation(
						untracked_writes[i],
						/** @type {Effect} */ (reaction)
					);
				}
			}

			// If we are returning to an previous reaction then
			// we need to increment the read version to ensure that
			// any dependencies in this reaction aren't marked with
			// the same version
			if (previous_reaction !== null && previous_reaction !== reaction) {
				read_version++;

				// update the `rv` of the previous reaction's deps — both existing and new —
				// so that they are not added again
				if (previous_reaction.deps !== null) {
					for (let i = 0; i < previous_skipped_deps; i += 1) {
						previous_reaction.deps[i].rv = read_version;
					}
				}

				if (previous_deps !== null) {
					for (const dep of previous_deps) {
						dep.rv = read_version;
					}
				}

				if (untracked_writes !== null) {
					if (previous_untracked_writes === null) {
						previous_untracked_writes = untracked_writes;
					} else {
						previous_untracked_writes.push(.../** @type {Source[]} */ (untracked_writes));
					}
				}
			}

			if ((reaction.f & ERROR_VALUE) !== 0) {
				reaction.f ^= ERROR_VALUE;
			}

			return result;
		} catch (error) {
			// still commit the deps read before the throw, otherwise deriveds connected by this run keep no reader and the reaction never re-runs when they change
			update_dependencies(reaction);

			return handle_error(error);
		} finally {
			reaction.f ^= REACTION_IS_UPDATING;
			new_deps = previous_deps;
			skipped_deps = previous_skipped_deps;
			untracked_writes = previous_untracked_writes;
			active_reaction = previous_reaction;
			current_sources = previous_sources;
			set_component_context(previous_component_context);
			untracking = previous_untracking;
			update_version = previous_update_version;
		}
	}

	/**
	 * @param {Reaction} reaction
	 */
	function update_dependencies(reaction) {
		var deps = reaction.deps;

		// Don't remove reactions during fork;
		// they must remain for when fork is discarded
		var is_fork = current_batch?.is_fork;

		if (new_deps !== null) {
			var i;

			if (!is_fork) {
				remove_reactions(reaction, skipped_deps);
			}

			if (deps !== null && skipped_deps > 0) {
				deps.length = skipped_deps + new_deps.length;
				for (i = 0; i < new_deps.length; i++) {
					deps[skipped_deps + i] = new_deps[i];
				}
			} else {
				reaction.deps = deps = new_deps;
			}

			if (effect_tracking() && (reaction.f & CONNECTED) !== 0) {
				for (i = skipped_deps; i < deps.length; i++) {
					(deps[i].reactions ??= []).push(reaction);
				}
			}
		} else if (!is_fork && deps !== null && skipped_deps < deps.length) {
			remove_reactions(reaction, skipped_deps);
			deps.length = skipped_deps;
		}

		return deps;
	}

	/**
	 * @template V
	 * @param {Reaction} signal
	 * @param {Value<V>} dependency
	 * @returns {void}
	 */
	function remove_reaction(signal, dependency) {
		let reactions = dependency.reactions;
		if (reactions !== null) {
			var index = index_of.call(reactions, signal);
			if (index !== -1) {
				var new_length = reactions.length - 1;
				if (new_length === 0) {
					reactions = dependency.reactions = null;
				} else {
					// Swap with last element and then remove.
					reactions[index] = reactions[new_length];
					reactions.pop();
				}
			}
		}

		// If the derived has no reactions, then we can disconnect it from the graph,
		// allowing it to either reconnect in the future, or be GC'd by the VM.
		if (
			reactions === null &&
			(dependency.f & DERIVED) !== 0 &&
			// Destroying a child effect while updating a parent effect can cause a dependency to appear
			// to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
			// allows us to skip the expensive work of disconnecting and immediately reconnecting it
			(new_deps === null || !includes.call(new_deps, dependency))
		) {
			var derived = /** @type {Derived} */ (dependency);

			// If we are working with a derived that is owned by an effect, then mark it as being
			// disconnected and remove the mark flag, as it cannot be reliably removed otherwise
			if ((derived.f & CONNECTED) !== 0) {
				derived.f ^= CONNECTED;
				derived.f &= ~WAS_MARKED;
			}

			// In a fork it's possible that a derived is executed and gets reactions, then commits, but is
			// never re-executed. This is possible when the derived is only executed once in the context
			// of a new branch which happens before fork.commit() runs. In this case, the derived still has
			// UNINITIALIZED as its value, and then when it's loosing its reactions we need to ensure it stays
			// DIRTY so it is reexecuted once someone wants its value again.
			if (derived.v !== UNINITIALIZED) {
				update_derived_status(derived);
			}

			// Call abort controller, noone's listening to this derived anymore
			if (derived.ac !== null) {
				without_reactive_context(() => {
					/** @type {AbortController} */ (derived.ac).abort(STALE_REACTION);
					derived.ac = null;
					// ensure it reruns right away next time instead of potentially returning a rejected promise as its value
					set_signal_status(derived, DIRTY);
				});
			}

			// freeze any effects inside this derived
			freeze_derived_effects(derived);

			// Disconnect any reactions owned by this reaction
			remove_reactions(derived, 0);
		}
	}

	/**
	 * @param {Reaction} signal
	 * @param {number} start_index
	 * @returns {void}
	 */
	function remove_reactions(signal, start_index) {
		var dependencies = signal.deps;
		if (dependencies === null) return;

		for (var i = start_index; i < dependencies.length; i++) {
			remove_reaction(signal, dependencies[i]);
		}
	}

	/**
	 * @param {Effect} effect
	 * @returns {void}
	 */
	function update_effect(effect) {
		var flags = effect.f;

		if ((flags & DESTROYED) !== 0) {
			return;
		}

		set_signal_status(effect, CLEAN);

		var previous_effect = active_effect;
		var was_updating_effect = is_updating_effect;

		active_effect = effect;
		is_updating_effect = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) === 0; // Branch/root effects are not reactive contexts

		try {
			if ((flags & (BLOCK_EFFECT | MANAGED_EFFECT)) !== 0) {
				destroy_block_effect_children(effect);
			} else {
				destroy_effect_children(effect);
			}

			execute_effect_teardown(effect);
			var teardown = update_reaction(effect);
			effect.teardown = typeof teardown === 'function' ? teardown : null;
			effect.wv = write_version;

			// In DEV, increment versions of any sources that were written to during the effect,
			// so that they are correctly marked as dirty when the effect re-runs
			var dep; if (DEV && tracing_mode_flag && (effect.f & DIRTY) !== 0 && effect.deps !== null) ;
		} finally {
			is_updating_effect = was_updating_effect;
			active_effect = previous_effect;
		}
	}

	/**
	 * Returns a promise that resolves once any pending state changes have been applied.
	 * @returns {Promise<void>}
	 */
	async function tick() {

		await Promise.resolve();

		// By calling flushSync we guarantee that any pending state changes are applied after one tick.
		// TODO look into whether we can make flushing subsequent updates synchronously in the future.
		flushSync();
	}

	/**
	 * @template V
	 * @param {Value<V>} signal
	 * @returns {V}
	 */
	function get(signal) {
		var flags = signal.f;
		var is_derived = (flags & DERIVED) !== 0;

		// Register the dependency on the current reaction signal.
		if (active_reaction !== null && !untracking) {
			// if we're in a derived that is being read inside an _async_ derived,
			// it's possible that the effect was already destroyed. In this case,
			// we don't add the dependency, because that would create a memory leak
			var destroyed = active_effect !== null && (active_effect.f & DESTROYED) !== 0;

			if (!destroyed && (current_sources === null || !current_sources.has(signal))) {
				var deps = active_reaction.deps;

				if ((active_reaction.f & REACTION_IS_UPDATING) !== 0) {
					// we're in the effect init/update cycle
					if (signal.rv < read_version) {
						signal.rv = read_version;

						// If the signal is accessing the same dependencies in the same
						// order as it did last time, increment `skipped_deps`
						// rather than updating `new_deps`, which creates GC cost
						if (new_deps === null && deps !== null && deps[skipped_deps] === signal) {
							skipped_deps++;
						} else if (new_deps === null) {
							new_deps = [signal];
						} else {
							new_deps.push(signal);
						}
					}
				} else {
					// We're adding a dependency outside the init/update cycle (i.e. after an `await`).
					// We have to deduplicate deps/reactions in this case or remove_reactions could
					// disconnect deps/reactions that are actually still in use (if skip_deps says
					// "disconnect all after this index" and some of the signals are also present in
					// list prior to the cutoff index, i.e. that should be kept).
					active_reaction.deps ??= [];
					if (!includes.call(active_reaction.deps, signal)) {
						active_reaction.deps.push(signal);
					}

					var reactions = signal.reactions;

					if (reactions === null) {
						signal.reactions = [active_reaction];
					} else if (!includes.call(reactions, active_reaction)) {
						reactions.push(active_reaction);
					}
				}
			}
		}

		if (is_destroying_effect && old_values.has(signal)) {
			return old_values.get(signal);
		}

		if (is_derived) {
			var derived = /** @type {Derived} */ (signal);

			if (is_destroying_effect) {
				var value = derived.v;

				// if the derived is dirty and has reactions, or depends on the values that just changed, re-execute
				// (a derived can be maybe_dirty due to the effect destroy removing its last reaction)
				if (
					((derived.f & CLEAN) === 0 && derived.reactions !== null) ||
					depends_on_old_values(derived)
				) {
					value = execute_derived(derived);
				}

				old_values.set(derived, value);

				return value;
			}

			// connect disconnected deriveds if we are reading them inside an effect,
			// or inside another derived that is already connected
			var should_connect =
				(derived.f & CONNECTED) === 0 &&
				!untracking &&
				active_reaction !== null &&
				(is_updating_effect || (active_reaction.f & CONNECTED) !== 0);

			var is_new = (derived.f & REACTION_RAN) === 0;

			if (is_dirty(derived)) {
				if (should_connect) {
					// set the flag before `update_derived`, so that the derived
					// is added as a reaction to its dependencies
					derived.f |= CONNECTED;
				}

				update_derived(derived);
			}

			if (should_connect && !is_new) {
				unfreeze_derived_effects(derived);
				reconnect(derived);
			}
		}

		if (batch_values?.has(signal)) {
			return batch_values.get(signal);
		}

		if ((signal.f & ERROR_VALUE) !== 0) {
			throw signal.v;
		}

		return signal.v;
	}

	/**
	 * (Re)connect a disconnected derived, so that it is notified
	 * of changes in `mark_reactions`
	 * @param {Derived} derived
	 */
	function reconnect(derived) {
		derived.f |= CONNECTED;

		if (derived.deps === null) return;

		for (const dep of derived.deps) {
			(dep.reactions ??= []).push(derived);

			if ((dep.f & DERIVED) !== 0 && (dep.f & CONNECTED) === 0) {
				unfreeze_derived_effects(/** @type {Derived} */ (dep));
				reconnect(/** @type {Derived} */ (dep));
			}
		}
	}

	/** @param {Derived} derived */
	function depends_on_old_values(derived) {
		if (derived.v === UNINITIALIZED) return true; // we don't know, so assume the worst
		if (derived.deps === null) return false;

		for (const dep of derived.deps) {
			if (old_values.has(dep)) {
				return true;
			}

			if ((dep.f & DERIVED) !== 0 && depends_on_old_values(/** @type {Derived} */ (dep))) {
				return true;
			}
		}

		return false;
	}

	/**
	 * When used inside a [`$derived`](https://svelte.dev/docs/svelte/$derived) or [`$effect`](https://svelte.dev/docs/svelte/$effect),
	 * any state read inside `fn` will not be treated as a dependency.
	 *
	 * ```ts
	 * $effect(() => {
	 *   // this will run when `data` changes, but not when `time` changes
	 *   save(data, {
	 *     timestamp: untrack(() => time)
	 *   });
	 * });
	 * ```
	 * @template T
	 * @param {() => T} fn
	 * @returns {T}
	 */
	function untrack(fn) {
		var previous_untracking = untracking;
		try {
			untracking = true;
			return fn();
		} finally {
			untracking = previous_untracking;
		}
	}

	/**
	 * Used on elements, as a map of event type -> event handler,
	 * and on events themselves to track which element handled an event
	 */
	const event_symbol = Symbol('events');

	/** @type {Set<string>} */
	const all_registered_events = new Set();

	/** @type {Set<(events: Array<string>) => void>} */
	const root_event_handles = new Set();

	/**
	 * @param {string} event_name
	 * @param {EventTarget} dom
	 * @param {EventListener} [handler]
	 * @param {AddEventListenerOptions} [options]
	 */
	function create_event(event_name, dom, handler, options = {}) {
		/**
		 * @this {EventTarget}
		 */
		function target_handler(/** @type {Event} */ event) {
			if (!options.capture) {
				// Only call in the bubble phase, else delegated events would be called before the capturing events
				handle_event_propagation.call(dom, event);
			}
			if (!event.cancelBubble) {
				return without_reactive_context(() => {
					return handler?.call(this, event);
				});
			}
		}

		// Chrome has a bug where pointer events don't work when attached to a DOM element that has been cloned
		// with cloneNode() and the DOM element is disconnected from the document. To ensure the event works, we
		// defer the attachment till after it's been appended to the document. TODO: remove this once Chrome fixes
		// this bug. The same applies to wheel events and touch events.
		if (
			event_name.startsWith('pointer') ||
			event_name.startsWith('touch') ||
			event_name === 'wheel'
		) {
			queue_micro_task(() => {
				dom.addEventListener(event_name, target_handler, options);
			});
		} else {
			dom.addEventListener(event_name, target_handler, options);
		}

		return target_handler;
	}

	/**
	 * @param {string} event_name
	 * @param {Element} dom
	 * @param {EventListener} [handler]
	 * @param {boolean} [capture]
	 * @param {boolean} [passive]
	 * @returns {void}
	 */
	function event(event_name, dom, handler, capture, passive) {
		var options = { capture, passive };
		var target_handler = create_event(event_name, dom, handler, options);

		if (
			dom === document.body ||
			// @ts-ignore
			dom === window ||
			// @ts-ignore
			dom === document ||
			// Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
			dom instanceof HTMLMediaElement
		) {
			teardown(() => {
				dom.removeEventListener(event_name, target_handler, options);
			});
		}
	}

	/**
	 * @param {string} event_name
	 * @param {Element} element
	 * @param {EventListener} [handler]
	 * @returns {void}
	 */
	function delegated(event_name, element, handler) {
		// @ts-expect-error
		(element[event_symbol] ??= {})[event_name] = handler;
	}

	/**
	 * @param {Array<string>} events
	 * @returns {void}
	 */
	function delegate(events) {
		for (var i = 0; i < events.length; i++) {
			all_registered_events.add(events[i]);
		}

		for (var fn of root_event_handles) {
			fn(events);
		}
	}

	// used to store the reference to the currently propagated event
	// to prevent garbage collection between microtasks in Firefox (<= 141)
	// If the event object is GCed too early, the expando __root property
	// set on the event object is lost, causing the event delegation
	// to process the event twice
	let last_propagated_event = null;

	// whether a task is already queued to clear `last_propagated_event`
	let last_propagated_event_clear_scheduled = false;

	/**
	 * @this {EventTarget}
	 * @param {Event} event
	 * @returns {void}
	 */
	function handle_event_propagation(event) {
		var handler_element = this;
		var owner_document = /** @type {Node} */ (handler_element).ownerDocument;
		var event_name = event.type;
		var path = event.composedPath?.() || [];
		var current_target = /** @type {null | Element} */ (path[0] || event.target);

		last_propagated_event = event;

		// The reference is only needed while the event can still reach another
		// delegated root, i.e. during the current (synchronous) dispatch and its
		// microtask checkpoints. Clearing it in a later task preserves the
		// Firefox workaround while making sure the slot doesn't retain the last
		// event forever — through `event.target` it would otherwise keep the
		// entire detached subtree of whatever the user last clicked in alive
		// until the next delegated event happens to arrive.
		if (!last_propagated_event_clear_scheduled) {
			last_propagated_event_clear_scheduled = true;
			setTimeout(() => {
				last_propagated_event_clear_scheduled = false;
				last_propagated_event = null;
			});
		}

		// composedPath contains list of nodes the event has propagated through.
		// We check `event_symbol` to skip all nodes below it in case this is a
		// parent of the `event_symbol` node, which indicates that there's nested
		// mounted apps. In this case we don't want to trigger events multiple times.
		var path_idx = 0;

		// the `last_propagated_event === event` check is redundant, but
		// without it the variable will be DCE'd and things will
		// fail mysteriously in Firefox
		// @ts-expect-error is added below
		var handled_at = last_propagated_event === event && event[event_symbol];

		if (handled_at) {
			var at_idx = path.indexOf(handled_at);
			if (
				at_idx !== -1 &&
				(handler_element === document || handler_element === /** @type {any} */ (window))
			) {
				// This is the fallback document listener or a window listener, but the event was already handled
				// -> ignore, but set handle_at to document/window so that we're resetting the event
				// chain in case someone manually dispatches the same event object again.
				// @ts-expect-error
				event[event_symbol] = handler_element;
				return;
			}

			// We're deliberately not skipping if the index is higher, because
			// someone could create an event programmatically and emit it multiple times,
			// in which case we want to handle the whole propagation chain properly each time.
			// (this will only be a false negative if the event is dispatched multiple times and
			// the fallback document listener isn't reached in between, but that's super rare)
			var handler_idx = path.indexOf(handler_element);
			if (handler_idx === -1) {
				// handle_idx can theoretically be -1 (happened in some JSDOM testing scenarios with an event listener on the window object)
				// so guard against that, too, and assume that everything was handled at this point.
				return;
			}

			if (at_idx <= handler_idx) {
				path_idx = at_idx;
			}
		}

		current_target = /** @type {Element} */ (path[path_idx] || event.target);
		// there can only be one delegated event per element, and we either already handled the current target,
		// or this is the very first target in the chain which has a non-delegated listener, in which case it's safe
		// to handle a possible delegated event on it later (through the root delegation listener for example).
		if (current_target === handler_element) return;

		// Proxy currentTarget to correct target
		define_property(event, 'currentTarget', {
			configurable: true,
			get() {
				return current_target || owner_document;
			}
		});

		// This started because of Chromium issue https://chromestatus.com/feature/5128696823545856,
		// where removal or moving of the DOM can cause sync `blur` events to fire, which can cause logic
		// to run inside the current `active_reaction`, which isn't what we want at all. However, on reflection,
		// it's probably best that all events handled by Svelte have this behaviour, as we don't really want
		// an event handler to run in the context of another reaction or effect.
		var previous_reaction = active_reaction;
		var previous_effect = active_effect;
		set_active_reaction(null);
		set_active_effect(null);

		try {
			/**
			 * @type {unknown}
			 */
			var throw_error;
			/**
			 * @type {unknown[]}
			 */
			var other_errors = [];

			while (current_target !== null) {
				if (current_target === handler_element) break;

				try {
					// @ts-expect-error
					var delegated = current_target[event_symbol]?.[event_name];

					if (
						delegated != null &&
						(!(/** @type {any} */ (current_target).disabled) ||
							// DOM could've been updated already by the time this is reached, so we check this as well
							// -> the target could not have been disabled because it emits the event in the first place
							event.target === current_target)
					) {
						delegated.call(current_target, event);
					}
				} catch (error) {
					if (throw_error) {
						other_errors.push(error);
					} else {
						throw_error = error;
					}
				}
				if (event.cancelBubble) break;

				path_idx++;
				current_target = path_idx < path.length ? /** @type {Element} */ (path[path_idx]) : null;
			}

			if (throw_error) {
				for (let error of other_errors) {
					// Throw the rest of the errors, one-by-one on a microtask
					queueMicrotask(() => {
						throw error;
					});
				}
				throw throw_error;
			}
		} finally {
			// @ts-expect-error is used above
			event[event_symbol] = handler_element;
			// @ts-ignore remove proxy on currentTarget
			delete event.currentTarget;
			set_active_reaction(previous_reaction);
			set_active_effect(previous_effect);
		}
	}

	const policy =
		// We gotta write it like this because after downleveling the pure comment may end up in the wrong location
		globalThis?.window?.trustedTypes &&
		/* @__PURE__ */ globalThis.window.trustedTypes.createPolicy('svelte-trusted-html', {
			/** @param {string} html */
			createHTML: (html) => {
				return html;
			}
		});

	/** @param {string} html */
	function create_trusted_html(html) {
		return /** @type {string} */ (policy?.createHTML(html) ?? html);
	}

	/**
	 * @param {string} html
	 */
	function create_fragment_from_html(html) {
		var elem = create_element('template');
		elem.innerHTML = create_trusted_html(html.replaceAll('<!>', '<!---->')); // XHTML compliance
		return elem.content;
	}

	/** @import { Effect, EffectNodes, TemplateNode } from '#client' */
	/** @import { TemplateStructure } from './types' */

	/**
	 * @param {TemplateNode} start
	 * @param {TemplateNode | null} end
	 */
	function assign_nodes(start, end) {
		var effect = /** @type {Effect} */ (active_effect);
		if (effect.nodes === null) {
			effect.nodes = { start, end, a: null, t: null };
		}
	}

	/**
	 * @param {string} content
	 * @param {number} flags
	 * @returns {() => Node | Node[]}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function from_html(content, flags) {
		var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
		var use_import_node = (flags & TEMPLATE_USE_IMPORT_NODE) !== 0;

		/** @type {Node} */
		var node;

		/**
		 * Whether or not the first item is a text/element node. If not, we need to
		 * create an additional comment node to act as `effect.nodes.start`
		 */
		var has_start = !content.startsWith('<!>');

		return () => {

			if (node === undefined) {
				node = create_fragment_from_html(has_start ? content : '<!>' + content);
				if (!is_fragment) node = /** @type {TemplateNode} */ (get_first_child(node));
			}

			var clone = /** @type {TemplateNode} */ (
				use_import_node || is_firefox ? document.importNode(node, true) : node.cloneNode(true)
			);

			if (is_fragment) {
				var start = /** @type {TemplateNode} */ (get_first_child(clone));
				var end = /** @type {TemplateNode} */ (clone.lastChild);

				assign_nodes(start, end);
			} else {
				assign_nodes(clone, clone);
			}

			return clone;
		};
	}

	/**
	 * @param {string} content
	 * @param {number} flags
	 * @param {'svg' | 'math'} ns
	 * @returns {() => Node | Node[]}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function from_namespace(content, flags, ns = 'svg') {
		/**
		 * Whether or not the first item is a text/element node. If not, we need to
		 * create an additional comment node to act as `effect.nodes.start`
		 */
		var has_start = !content.startsWith('<!>');

		var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
		var wrapped = `<${ns}>${has_start ? content : '<!>' + content}</${ns}>`;

		/** @type {Element | DocumentFragment} */
		var node;

		return () => {

			if (!node) {
				var fragment = /** @type {DocumentFragment} */ (create_fragment_from_html(wrapped));
				var root = /** @type {Element} */ (get_first_child(fragment));

				if (is_fragment) {
					node = document.createDocumentFragment();
					while (get_first_child(root)) {
						node.appendChild(/** @type {TemplateNode} */ (get_first_child(root)));
					}
				} else {
					node = /** @type {Element} */ (get_first_child(root));
				}
			}

			var clone = /** @type {TemplateNode} */ (node.cloneNode(true));

			if (is_fragment) {
				var start = /** @type {TemplateNode} */ (get_first_child(clone));
				var end = /** @type {TemplateNode} */ (clone.lastChild);

				assign_nodes(start, end);
			} else {
				assign_nodes(clone, clone);
			}

			return clone;
		};
	}

	/**
	 * @param {string} content
	 * @param {number} flags
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function from_svg(content, flags) {
		return from_namespace(content, flags, 'svg');
	}

	/**
	 * Don't mark this as side-effect-free, hydration needs to walk all nodes
	 * @param {any} value
	 */
	function text(value = '') {
		{
			var t = create_text(value + '');
			assign_nodes(t, t);
			return t;
		}
	}

	/**
	 * @returns {TemplateNode | DocumentFragment}
	 */
	function comment() {

		var frag = document.createDocumentFragment();
		var start = document.createComment('');
		var anchor = create_text();
		frag.append(start, anchor);

		assign_nodes(start, anchor);

		return frag;
	}

	/**
	 * Assign the created (or in hydration mode, traversed) dom elements to the current block
	 * and insert the elements into the dom (in client mode).
	 * @param {Text | Comment | Element} anchor
	 * @param {DocumentFragment | Element} dom
	 */
	function append(anchor, dom) {

		if (anchor === null) {
			// edge case — void `<svelte:element>` with content
			return;
		}

		anchor.before(/** @type {Node} */ (dom));
	}

	/**
	 * Subset of delegated events which should be passive by default.
	 * These two are already passive via browser defaults on window, document and body.
	 * But since
	 * - we're delegating them
	 * - they happen often
	 * - they apply to mobile which is generally less performant
	 * we're marking them as passive by default for other elements, too.
	 */
	const PASSIVE_EVENTS = ['touchstart', 'touchmove'];

	/**
	 * Returns `true` if `name` is a passive event
	 * @param {string} name
	 */
	function is_passive_event(name) {
		return PASSIVE_EVENTS.includes(name);
	}

	/**
	 * Returns a `subscribe` function that integrates external event-based systems with Svelte's reactivity.
	 * It's particularly useful for integrating with web APIs like `MediaQuery`, `IntersectionObserver`, or `WebSocket`.
	 *
	 * If `subscribe` is called inside an effect (including indirectly, for example inside a getter),
	 * the `start` callback will be called with an `update` function. Whenever `update` is called, the effect re-runs.
	 *
	 * If `start` returns a cleanup function, it will be called when the effect is destroyed.
	 *
	 * If `subscribe` is called in multiple effects, `start` will only be called once as long as the effects
	 * are active, and the returned teardown function will only be called when all effects are destroyed.
	 *
	 * It's best understood with an example. Here's an implementation of [`MediaQuery`](https://svelte.dev/docs/svelte/svelte-reactivity#MediaQuery):
	 *
	 * ```js
	 * import { createSubscriber } from 'svelte/reactivity';
	 * import { on } from 'svelte/events';
	 *
	 * export class MediaQuery {
	 * 	#query;
	 * 	#subscribe;
	 *
	 * 	constructor(query) {
	 * 		this.#query = window.matchMedia(`(${query})`);
	 *
	 * 		this.#subscribe = createSubscriber((update) => {
	 * 			// when the `change` event occurs, re-run any effects that read `this.current`
	 * 			const off = on(this.#query, 'change', update);
	 *
	 * 			// stop listening when all the effects are destroyed
	 * 			return () => off();
	 * 		});
	 * 	}
	 *
	 * 	get current() {
	 * 		// This makes the getter reactive, if read in an effect
	 * 		this.#subscribe();
	 *
	 * 		// Return the current state of the query, whether or not we're in an effect
	 * 		return this.#query.matches;
	 * 	}
	 * }
	 * ```
	 * @param {(update: () => void) => (() => void) | void} start
	 * @since 5.7.0
	 */
	function createSubscriber(start) {
		let subscribers = 0;
		let version = source(0);
		/** @type {(() => void) | void} */
		let stop;

		return () => {
			if (effect_tracking()) {
				get(version);

				render_effect(() => {
					if (subscribers === 0) {
						stop = untrack(() => start(() => increment(version)));
					}

					subscribers += 1;

					return () => {
						queue_micro_task(() => {
							// Only count down after a microtask, else we would reach 0 before our own render effect reruns,
							// but reach 1 again when the tick callback of the prior teardown runs. That would mean we
							// re-subcribe unnecessarily and create a memory leak because the old subscription is never cleaned up.
							subscribers -= 1;

							if (subscribers === 0) {
								stop?.();
								stop = undefined;
								// Increment the version to ensure any dependent deriveds are marked dirty when the subscription is picked up again later.
								// If we didn't do this then the comparison of write versions would determine that the derived has a later version than
								// the subscriber, and it would not be re-run.
								increment(version);
							}
						});
					};
				});
			}
		};
	}

	/** @import { Effect, Source, TemplateNode, } from '#client' */

	/**
	 * @typedef {{
	 * 	 onerror?: ((error: unknown, reset: () => void) => void) | null;
	 *   failed?: ((anchor: Node, error: () => unknown, reset: () => () => void) => void) | null;
	 *   pending?: ((anchor: Node) => void) | null;
	 * }} BoundaryProps
	 */

	var flags = EFFECT_TRANSPARENT | EFFECT_PRESERVED;

	/**
	 * @param {TemplateNode} node
	 * @param {BoundaryProps} props
	 * @param {((anchor: Node) => void)} children
	 * @param {((error: unknown) => unknown) | undefined} [transform_error]
	 * @returns {void}
	 */
	function boundary(node, props, children, transform_error) {
		new Boundary(node, props, children, transform_error);
	}

	class Boundary {
		/** @type {Boundary | null} */
		parent;

		is_pending = false;

		/**
		 * API-level transformError transform function. Transforms errors before they reach the `failed` snippet.
		 * Inherited from parent boundary, or defaults to identity.
		 * @type {(error: unknown) => unknown}
		 */
		transform_error;

		/** @type {TemplateNode} */
		#anchor;

		/** @type {TemplateNode | null} */
		#hydrate_open = null;

		/** @type {BoundaryProps} */
		#props;

		/** @type {((anchor: Node) => void)} */
		#children;

		/** @type {Effect} */
		#effect;

		/** @type {Effect | null} */
		#main_effect = null;

		/** @type {Effect | null} */
		#pending_effect = null;

		/** @type {Effect | null} */
		#failed_effect = null;

		/** @type {DocumentFragment | null} */
		#offscreen_fragment = null;

		#local_pending_count = 0;
		#pending_count = 0;
		#pending_count_update_queued = false;

		/** @type {Set<Effect>} */
		#dirty_effects = new Set();

		/** @type {Set<Effect>} */
		#maybe_dirty_effects = new Set();

		/**
		 * A source containing the number of pending async deriveds/expressions.
		 * Only created if `$effect.pending()` is used inside the boundary,
		 * otherwise updating the source results in needless `Batch.ensure()`
		 * calls followed by no-op flushes
		 * @type {Source<number> | null}
		 */
		#effect_pending = null;

		#effect_pending_subscriber = createSubscriber(() => {
			this.#effect_pending = source(this.#local_pending_count);

			return () => {
				this.#effect_pending = null;
			};
		});

		/**
		 * @param {TemplateNode} node
		 * @param {BoundaryProps} props
		 * @param {((anchor: Node) => void)} children
		 * @param {((error: unknown) => unknown) | undefined} [transform_error]
		 */
		constructor(node, props, children, transform_error) {
			this.#anchor = node;
			this.#props = props;

			this.#children = (anchor) => {
				var effect = /** @type {Effect} */ (active_effect);

				effect.b = this;
				effect.f |= BOUNDARY_EFFECT;

				children(anchor);
			};

			this.parent = /** @type {Effect} */ (active_effect).b;

			// Inherit transform_error from parent boundary, or use the provided one, or default to identity
			this.transform_error = transform_error ?? this.parent?.transform_error ?? ((e) => e);

			this.#effect = block(() => {
				{
					this.#render();
				}
			}, flags);
		}

		#hydrate_resolved_content() {
			try {
				this.#main_effect = branch(() => this.#children(this.#anchor));
			} catch (error) {
				this.error(error);
			}
		}

		/**
		 * @param {unknown} error The deserialized error from the server's hydration comment
		 */
		#hydrate_failed_content(error) {
			const failed = this.#props.failed;
			const { reset, invoke_onerror } = this.#create_reset(error);

			// `onerror` may mutate state, which is disallowed while hydrating
			queue_micro_task(invoke_onerror);

			if (!failed) return;

			this.#failed_effect = branch(() => {
				failed(
					this.#anchor,
					() => error,
					() => reset
				);
			});
		}

		/**
		 * Creates the `reset` function for a failed boundary, along with a function
		 * that invokes `onerror` with it (if provided)
		 * @param {unknown} error
		 * @returns {{ reset: () => void, invoke_onerror: () => void }}
		 */
		#create_reset(error) {
			var did_reset = false;
			var calling_on_error = false;

			const reset = () => {
				if (did_reset) {
					svelte_boundary_reset_noop();
					return;
				}

				did_reset = true;

				if (calling_on_error) {
					svelte_boundary_reset_onerror();
				}

				if (this.#failed_effect !== null) {
					pause_effect(this.#failed_effect, () => {
						this.#failed_effect = null;
					});
				}

				this.#run(() => {
					this.#render();
				});
			};

			const invoke_onerror = () => {
				try {
					calling_on_error = true;
					this.#props.onerror?.(error, reset);
					calling_on_error = false;
				} catch (err) {
					invoke_error_boundary(err, this.#effect && this.#effect.parent);
				}
			};

			return { reset, invoke_onerror };
		}

		#hydrate_pending_content() {
			const pending = this.#props.pending;
			if (!pending) return;

			this.is_pending = true;
			this.#pending_effect = branch(() => pending(this.#anchor));

			queue_micro_task(() => {
				var fragment = (this.#offscreen_fragment = document.createDocumentFragment());
				var anchor = create_text();
				var handled = false;

				fragment.append(anchor);

				this.#main_effect = this.#run(() => {
					try {
						return branch(() => this.#children(anchor));
					} catch (error) {
						try {
							this.error(error);
							handled = true;
						} catch (error) {
							invoke_error_boundary(error, this.#effect.parent);
						}

						return null;
					}
				});

				if (this.#main_effect === null) {
					this.#offscreen_fragment = null;
					if (handled) this.#resolve(/** @type {Batch} */ (current_batch));
					return;
				}

				if (this.#pending_count === 0) {
					this.#anchor.before(fragment);
					this.#offscreen_fragment = null;

					pause_effect(/** @type {Effect} */ (this.#pending_effect), () => {
						this.#pending_effect = null;
					});

					this.#resolve(/** @type {Batch} */ (current_batch));
				}
			});
		}

		#render() {
			try {
				this.is_pending = this.has_pending_snippet();
				this.#pending_count = 0;
				this.#local_pending_count = 0;

				this.#main_effect = branch(() => {
					this.#children(this.#anchor);
				});

				if (this.#pending_count > 0) {
					var fragment = (this.#offscreen_fragment = document.createDocumentFragment());
					move_effect(this.#main_effect, fragment);

					const pending = /** @type {(anchor: Node) => void} */ (this.#props.pending);
					this.#pending_effect = branch(() => pending(this.#anchor));
				} else {
					this.#resolve(/** @type {Batch} */ (current_batch));
				}
			} catch (error) {
				this.error(error);
			}
		}

		/**
		 * @param {Batch} batch
		 */
		#resolve(batch) {
			this.is_pending = false;

			// any effects that were previously deferred should be transferred
			// to the batch, which will flush in the next microtask
			batch.transfer_effects(this.#dirty_effects, this.#maybe_dirty_effects);
		}

		/**
		 * Defer an effect inside a pending boundary until the boundary resolves
		 * @param {Effect} effect
		 */
		defer_effect(effect) {
			defer_effect(effect, this.#dirty_effects, this.#maybe_dirty_effects);
		}

		/**
		 * Returns `false` if the effect exists inside a boundary whose pending snippet is shown
		 * @returns {boolean}
		 */
		is_rendered() {
			return !this.is_pending && (!this.parent || this.parent.is_rendered());
		}

		has_pending_snippet() {
			return !!this.#props.pending;
		}

		/**
		 * @template T
		 * @param {() => T} fn
		 */
		#run(fn) {
			var previous_effect = active_effect;
			var previous_reaction = active_reaction;
			var previous_ctx = component_context;

			set_active_effect(this.#effect);
			set_active_reaction(this.#effect);
			set_component_context(this.#effect.ctx);

			try {
				Batch.ensure();
				return fn();
			} finally {
				set_active_effect(previous_effect);
				set_active_reaction(previous_reaction);
				set_component_context(previous_ctx);
			}
		}

		/**
		 * Updates the pending count associated with the currently visible pending snippet,
		 * if any, such that we can replace the snippet with content once work is done
		 * @param {1 | -1} d
		 * @param {Batch} batch
		 */
		#update_pending_count(d, batch) {
			if (!this.has_pending_snippet()) {
				if (this.parent) {
					this.parent.#update_pending_count(d, batch);
				}

				// if there's no parent, we're in a scope with no pending snippet
				return;
			}

			this.#pending_count += d;

			if (this.#pending_count === 0) {
				this.#resolve(batch);

				if (this.#pending_effect) {
					pause_effect(this.#pending_effect, () => {
						this.#pending_effect = null;
					});
				}

				if (this.#offscreen_fragment) {
					this.#anchor.before(this.#offscreen_fragment);
					this.#offscreen_fragment = null;
				}
			}
		}

		/**
		 * Update the source that powers `$effect.pending()` inside this boundary,
		 * and controls when the current `pending` snippet (if any) is removed.
		 * Do not call from inside the class
		 * @param {1 | -1} d
		 * @param {Batch} batch
		 */
		update_pending_count(d, batch) {
			this.#update_pending_count(d, batch);

			this.#local_pending_count += d;

			if (!this.#effect_pending || this.#pending_count_update_queued) return;
			this.#pending_count_update_queued = true;

			queue_micro_task(() => {
				this.#pending_count_update_queued = false;
				if (this.#effect_pending) {
					internal_set(this.#effect_pending, this.#local_pending_count);
				}
			});
		}

		get_effect_pending() {
			this.#effect_pending_subscriber();
			return get(/** @type {Source<number>} */ (this.#effect_pending));
		}

		/** @param {unknown} error */
		error(error) {
			// If we have nothing to capture the error, or if we hit an error while
			// rendering the fallback, re-throw for another boundary to handle
			if (!this.#props.onerror && !this.#props.failed) {
				throw error;
			}

			if (current_batch?.is_fork) {
				if (this.#main_effect) current_batch.skip_effect(this.#main_effect);
				if (this.#pending_effect) current_batch.skip_effect(this.#pending_effect);
				if (this.#failed_effect) current_batch.skip_effect(this.#failed_effect);

				current_batch.oncommit(() => {
					this.#handle_error(error);
				});
			} else {
				this.#handle_error(error);
			}
		}

		/**
		 * @param {unknown} error
		 */
		#handle_error(error) {
			if (this.#main_effect) {
				destroy_effect(this.#main_effect);
				this.#main_effect = null;
			}

			if (this.#pending_effect) {
				destroy_effect(this.#pending_effect);
				this.#pending_effect = null;
			}

			if (this.#failed_effect) {
				destroy_effect(this.#failed_effect);
				this.#failed_effect = null;
			}

			let failed = this.#props.failed;

			/** @param {unknown} transformed_error */
			const handle_error_result = (transformed_error) => {
				const { reset, invoke_onerror } = this.#create_reset(transformed_error);

				invoke_onerror();

				if (failed) {
					this.#failed_effect = this.#run(() => {
						try {
							return branch(() => {
								// errors in `failed` snippets cause the boundary to error again
								// TODO Svelte 6: revisit this decision, most likely better to go to parent boundary instead
								var effect = /** @type {Effect} */ (active_effect);

								effect.b = this;
								effect.f |= BOUNDARY_EFFECT;

								failed(
									this.#anchor,
									() => transformed_error,
									() => reset
								);
							});
						} catch (error) {
							invoke_error_boundary(error, /** @type {Effect} */ (this.#effect.parent));
							return null;
						}
					});
				}
			};

			queue_micro_task(() => {
				// Run the error through the API-level transformError transform (e.g. SvelteKit's handleError)
				/** @type {unknown} */
				var result;
				try {
					result = this.transform_error(error);
				} catch (e) {
					invoke_error_boundary(e, this.#effect && this.#effect.parent);
					return;
				}

				if (
					result !== null &&
					typeof result === 'object' &&
					typeof (/** @type {any} */ (result).then) === 'function'
				) {
					// transformError returned a Promise — wait for it
					/** @type {any} */ (result).then(
						handle_error_result,
						/** @param {unknown} e */
						(e) => invoke_error_boundary(e, this.#effect && this.#effect.parent)
					);
				} else {
					// Synchronous result — handle immediately
					handle_error_result(result);
				}
			});
		}
	}

	/** @import { ComponentContext, Effect, EffectNodes, TemplateNode } from '#client' */
	/** @import { Component, ComponentType, SvelteComponent, MountOptions } from '../../index.js' */

	/**
	 * @param {Element} text
	 * @param {string} value
	 * @returns {void}
	 */
	function set_text(text, value) {
		// For objects, we apply string coercion (which might make things like $state array references in the template reactive) before diffing
		var str = value == null ? '' : typeof value === 'object' ? `${value}` : value;
		// prettier-ignore
		if (str !== (/** @type {any} */ (text)[TEXT_CACHE] ??= text.nodeValue)) {
			/** @type {any} */ (text)[TEXT_CACHE] = str;
			text.nodeValue = `${str}`;
		}
	}

	/**
	 * Mounts a component to the given target and returns the exports and potentially the props (if compiled with `accessors: true`) of the component.
	 * Transitions will play during the initial render unless the `intro` option is set to `false`.
	 *
	 * @template {Record<string, any>} Props
	 * @template {Record<string, any>} Exports
	 * @param {ComponentType<SvelteComponent<Props>> | Component<Props, Exports, any>} component
	 * @param {MountOptions<Props>} options
	 * @returns {Exports}
	 */
	function mount(component, options) {
		return _mount(component, options);
	}

	/** @type {Map<EventTarget, Map<string, number>>} */
	const listeners = new Map();

	/**
	 * @template {Record<string, any>} Exports
	 * @param {ComponentType<SvelteComponent<any>> | Component<any>} Component
	 * @param {MountOptions} options
	 * @returns {Exports}
	 */
	function _mount(
		Component,
		{ target, anchor, props = {}, events, context, intro = true, transformError }
	) {
		init_operations();

		/** @type {Exports} */
		// @ts-expect-error will be defined because the render effect runs synchronously
		var component = undefined;

		var unmount = component_root(() => {
			var anchor_node = anchor ?? target.appendChild(create_text());

			boundary(
				/** @type {TemplateNode} */ (anchor_node),
				{
					pending: () => {}
				},
				(anchor_node) => {
					push({});
					var ctx = /** @type {ComponentContext} */ (component_context);
					if (context) ctx.c = context;

					if (events) {
						// We can't spread the object or else we'd lose the state proxy stuff, if it is one
						/** @type {any} */ (props).$$events = events;
					}
					// @ts-expect-error the public typings are not what the actual function looks like
					component = Component(anchor_node, props) || mark_as_component();

					pop();
				},
				transformError
			);

			// Setup event delegation _after_ component is mounted - if an error would happen during mount, it would otherwise not be cleaned up
			/** @type {Set<string>} */
			var registered_events = new Set();

			/** @param {Array<string>} events */
			var event_handle = (events) => {
				for (var i = 0; i < events.length; i++) {
					var event_name = events[i];

					if (registered_events.has(event_name)) continue;
					registered_events.add(event_name);

					var passive = is_passive_event(event_name);

					// Add the event listener to both the container and the document.
					// The container listener ensures we catch events from within in case
					// the outer content stops propagation of the event.
					//
					// The document listener ensures we catch events that originate from elements that were
					// manually moved outside of the container (e.g. via manual portals).
					for (const node of [target, document]) {
						var counts = listeners.get(node);

						if (counts === undefined) {
							counts = new Map();
							listeners.set(node, counts);
						}

						var count = counts.get(event_name);

						if (count === undefined) {
							node.addEventListener(event_name, handle_event_propagation, { passive });
							counts.set(event_name, 1);
						} else {
							counts.set(event_name, count + 1);
						}
					}
				}
			};

			event_handle(array_from(all_registered_events));
			root_event_handles.add(event_handle);

			return () => {
				for (var event_name of registered_events) {
					for (const node of [target, document]) {
						var counts = /** @type {Map<string, number>} */ (listeners.get(node));
						var count = /** @type {number} */ (counts.get(event_name));

						if (--count == 0) {
							node.removeEventListener(event_name, handle_event_propagation);
							counts.delete(event_name);

							if (counts.size === 0) {
								listeners.delete(node);
							}
						} else {
							counts.set(event_name, count);
						}
					}
				}

				root_event_handles.delete(event_handle);

				if (anchor_node !== anchor) {
					anchor_node.parentNode?.removeChild(anchor_node);
				}
			};
		});

		mounted_components.set(component, unmount);
		return component;
	}

	/**
	 * References of the components that were mounted or hydrated.
	 * Uses a `WeakMap` to avoid memory leaks.
	 */
	let mounted_components = new WeakMap();

	/**
	 * Unmounts a component that was previously mounted using `mount` or `hydrate`.
	 *
	 * Since 5.13.0, if `options.outro` is `true`, [transitions](https://svelte.dev/docs/svelte/transition) will play before the component is removed from the DOM.
	 *
	 * Returns a `Promise` that resolves after transitions have completed if `options.outro` is true, or immediately otherwise (prior to 5.13.0, returns `void`).
	 *
	 * ```js
	 * import { mount, unmount } from 'svelte';
	 * import App from './App.svelte';
	 *
	 * const app = mount(App, { target: document.body });
	 *
	 * // later...
	 * unmount(app, { outro: true });
	 * ```
	 * @param {Record<string, any>} component
	 * @param {{ outro?: boolean }} [options]
	 * @returns {Promise<void>}
	 */
	function unmount(component, options) {
		const fn = mounted_components.get(component);

		if (fn) {
			mounted_components.delete(component);
			return fn(options);
		}

		return Promise.resolve();
	}

	/** @import { Effect, TemplateNode } from '#client' */

	/**
	 * @typedef {{ effect: Effect, fragment: DocumentFragment }} Branch
	 */

	/**
	 * @template Key
	 */
	class BranchManager {
		/** @type {TemplateNode} */
		anchor;

		/** @type {Map<Batch, Key>} */
		#batches = new Map();

		/**
		 * Map of keys to effects that are currently rendered in the DOM.
		 * These effects are visible and actively part of the document tree.
		 * Example:
		 * ```
		 * {#if condition}
		 * 	foo
		 * {:else}
		 * 	bar
		 * {/if}
		 * ```
		 * Can result in the entries `true->Effect` and `false->Effect`
		 * @type {Map<Key, Effect>}
		 */
		#onscreen = new Map();

		/**
		 * Similar to #onscreen with respect to the keys, but contains branches that are not yet
		 * in the DOM, because their insertion is deferred.
		 * @type {Map<Key, Branch>}
		 */
		#offscreen = new Map();

		/**
		 * Keys of effects that are currently outroing
		 * @type {Set<Key>}
		 */
		#outroing = new Set();

		/**
		 * Whether to pause (i.e. outro) on change, or destroy immediately.
		 * This is necessary for `<svelte:element>`
		 */
		#transition = true;

		/**
		 * @param {TemplateNode} anchor
		 * @param {boolean} transition
		 */
		constructor(anchor, transition = true) {
			this.anchor = anchor;
			this.#transition = transition;
		}

		/**
		 * @param {Batch} batch
		 */
		#commit = (batch) => {
			// if this batch was made obsolete, bail
			if (!this.#batches.has(batch)) return;

			var key = /** @type {Key} */ (this.#batches.get(batch));

			var onscreen = this.#onscreen.get(key);

			if (onscreen) {
				// effect is already in the DOM — abort any current outro
				resume_effect(onscreen);
				this.#outroing.delete(key);
			} else {
				// effect is currently offscreen. put it in the DOM
				var offscreen = this.#offscreen.get(key);

				if (offscreen) {
					// effect could have been outro'ed before through a prior batch — resume if necessary
					resume_effect(offscreen.effect);
					this.#onscreen.set(key, offscreen.effect);
					this.#offscreen.delete(key);

					// remove the anchor...
					/** @type {TemplateNode} */ (offscreen.fragment.lastChild).remove();

					// ...and append the fragment
					this.anchor.before(offscreen.fragment);
					onscreen = offscreen.effect;
				}
			}

			for (const [b, k] of this.#batches) {
				this.#batches.delete(b);

				if (b === batch) {
					// keep values for newer batches
					break;
				}

				const offscreen = this.#offscreen.get(k);

				if (offscreen) {
					// for older batches, destroy offscreen effects
					// as they will never be committed
					destroy_effect(offscreen.effect);
					this.#offscreen.delete(k);
				}
			}

			// outro/destroy all onscreen effects...
			for (const [k, effect] of this.#onscreen) {
				// ...except the one that was just committed
				//    or those that are already outroing (else the transition is aborted and the effect destroyed right away)
				if (k === key || this.#outroing.has(k)) continue;

				const on_destroy = () => {
					const keys = Array.from(this.#batches.values());

					if (keys.includes(k)) {
						// keep the effect offscreen, as another batch will need it
						var fragment = document.createDocumentFragment();
						move_effect(effect, fragment);

						fragment.append(create_text()); // TODO can we avoid this?

						this.#offscreen.set(k, { effect, fragment });
					} else {
						destroy_effect(effect);
					}

					this.#outroing.delete(k);
					this.#onscreen.delete(k);
				};

				if (this.#transition || !onscreen) {
					this.#outroing.add(k);
					pause_effect(effect, on_destroy, false);
				} else {
					on_destroy();
				}
			}
		};

		/**
		 * @param {Batch} batch
		 */
		#discard = (batch) => {
			this.#batches.delete(batch);

			const keys = Array.from(this.#batches.values());

			for (const [k, branch] of this.#offscreen) {
				if (!keys.includes(k)) {
					destroy_effect(branch.effect);
					this.#offscreen.delete(k);
				}
			}
		};

		/**
		 *
		 * @param {any} key
		 * @param {null | ((target: TemplateNode) => void)} fn
		 */
		ensure(key, fn) {
			var batch = /** @type {Batch} */ (current_batch);

			if (fn && !this.#onscreen.has(key) && !this.#offscreen.has(key)) {
				{
					this.#onscreen.set(
						key,
						branch(() => fn(this.anchor))
					);
				}
			}

			this.#batches.set(batch, key);

			{

				this.#commit(batch);
			}
		}
	}

	/** @import { Snippet } from 'svelte' */
	/** @import { TemplateNode } from '#client' */
	/** @import { Getters } from '#shared' */

	/**
	 * @template {(node: TemplateNode, ...args: any[]) => void} SnippetFn
	 * @param {TemplateNode} node
	 * @param {() => SnippetFn | null | undefined} get_snippet
	 * @param {(() => any)[]} args
	 * @returns {void}
	 */
	function snippet(node, get_snippet, ...args) {
		var branches = new BranchManager(node);

		block(() => {
			const snippet = get_snippet() ?? null;

			branches.ensure(snippet, snippet && ((anchor) => snippet(anchor, ...args)));
		}, EFFECT_TRANSPARENT);
	}

	/** @import { TemplateNode } from '#client' */

	/**
	 * @param {TemplateNode} node
	 * @param {(branch: (fn: (anchor: Node) => void, key?: number | false) => void) => void} fn
	 * @param {boolean} [elseif] True if this is an `{:else if ...}` block rather than an `{#if ...}`, as that affects which transitions are considered 'local'
	 * @returns {void}
	 */
	function if_block(node, fn, elseif = false) {

		var branches = new BranchManager(node);
		var flags = elseif ? EFFECT_TRANSPARENT : 0;

		/**
		 * @param {number | false} key
		 * @param {null | ((anchor: Node) => void)} fn
		 */
		function update_branch(key, fn) {

			branches.ensure(key, fn);
		}

		block(() => {
			var has_branch = false;

			fn((fn, key = 0) => {
				has_branch = true;
				update_branch(key, fn);
			});

			if (!has_branch) {
				update_branch(-1, null);
			}
		}, flags);
	}

	/** @import { EachItem, EachOutroGroup, EachState, Effect, EffectNodes, MaybeSource, Source, TemplateNode, TransitionManager, Value } from '#client' */
	/** @import { Batch } from '../../reactivity/batch.js'; */

	// When making substantive changes to this file, validate them with the each block stress test:
	// https://svelte.dev/playground/1972b2cf46564476ad8c8c6405b23b7b
	// This test also exists in this repo, as `packages/svelte/tests/manual/each-stress-test`

	/**
	 * @param {any} _
	 * @param {number} i
	 */
	function index(_, i) {
		return i;
	}

	/**
	 * Pause multiple effects simultaneously, and coordinate their
	 * subsequent destruction. Used in each blocks
	 * @param {EachState} state
	 * @param {Effect[]} to_destroy
	 * @param {null | Node} controlled_anchor
	 */
	function pause_effects(state, to_destroy, controlled_anchor) {
		/** @type {TransitionManager[]} */
		var transitions = [];
		var length = to_destroy.length;

		/** @type {EachOutroGroup} */
		var group;
		var remaining = to_destroy.length;

		for (var i = 0; i < length; i++) {
			let effect = to_destroy[i];

			pause_effect(
				effect,
				() => {
					if (group) {
						group.pending.delete(effect);
						group.done.add(effect);

						if (group.pending.size === 0) {
							var groups = /** @type {Set<EachOutroGroup>} */ (state.outrogroups);

							destroy_effects(state, array_from(group.done));
							groups.delete(group);

							if (groups.size === 0) {
								state.outrogroups = null;
							}
						}
					} else {
						remaining -= 1;
					}
				},
				false
			);
		}

		if (remaining === 0) {
			// If we're in a controlled each block (i.e. the block is the only child of an
			// element), and we are removing all items, _and_ there are no out transitions,
			// we can use the fast path — emptying the element and replacing the anchor.
			// Skip the fast path when another batch is still pending on this each block:
			// that batch's keys still reference EachItems in `state.items`, which
			// `destroy_effects` needs to preserve offscreen (see #18610).
			var fast_path =
				transitions.length === 0 && controlled_anchor !== null && state.pending.size === 0;

			if (fast_path) {
				var anchor = /** @type {Element} */ (controlled_anchor);
				var parent_node = /** @type {Element} */ (anchor.parentNode);

				clear_text_content(parent_node);
				parent_node.append(anchor);

				state.items.clear();
			}

			destroy_effects(state, to_destroy, !fast_path);
		} else {
			group = {
				pending: new Set(to_destroy),
				done: new Set()
			};

			(state.outrogroups ??= new Set()).add(group);
		}
	}

	/**
	 * @param {EachState} state
	 * @param {Effect[]} to_destroy
	 * @param {boolean} remove_dom
	 */
	function destroy_effects(state, to_destroy, remove_dom = true) {
		/** @type {Set<Effect> | undefined} */
		var preserved_effects;

		// The loop-in-a-loop isn't ideal, but we should only hit this in relatively rare cases
		if (state.pending.size > 0) {
			preserved_effects = new Set();

			for (const keys of state.pending.values()) {
				for (const key of keys) {
					preserved_effects.add(/** @type {EachItem} */ (state.items.get(key)).e);
				}
			}
		}

		for (var i = 0; i < to_destroy.length; i++) {
			var e = to_destroy[i];

			if (preserved_effects?.has(e)) {
				e.f |= EFFECT_OFFSCREEN;

				const fragment = document.createDocumentFragment();
				move_effect(e, fragment);
			} else {
				destroy_effect(to_destroy[i], remove_dom);
			}
		}
	}

	/** @type {TemplateNode} */
	var offscreen_anchor;

	/**
	 * @template V
	 * @param {Element | Comment} node The next sibling node, or the parent node if this is a 'controlled' block
	 * @param {number} flags
	 * @param {() => V[]} get_collection
	 * @param {(value: V, index: number) => any} get_key
	 * @param {(anchor: Node, item: MaybeSource<V>, index: MaybeSource<number>) => void} render_fn
	 * @param {null | ((anchor: Node) => void)} fallback_fn
	 * @returns {void}
	 */
	function each(node, flags, get_collection, get_key, render_fn, fallback_fn = null) {
		var anchor = node;

		/** @type {Map<any, EachItem>} */
		var items = new Map();

		var is_controlled = (flags & EACH_IS_CONTROLLED) !== 0;

		if (is_controlled) {
			var parent_node = /** @type {Element} */ (node);

			anchor = parent_node.appendChild(create_text());
		}

		/** @type {Effect | null} */
		var fallback = null;

		// TODO: ideally we could use derived for runes mode but because of the ability
		// to use a store which can be mutated, we can't do that here as mutating a store
		// will still result in the collection array being the same from the store
		var each_array = derived_safe_equal(() => {
			var collection = get_collection();

			return /** @type {V[]} */ (
				is_array(collection) ? collection : collection == null ? [] : array_from(collection)
			);
		});

		/** @type {V[]} */
		var array;

		/** @type {Map<Batch, Set<any>>} */
		var pending = new Map();

		var first_run = true;

		/**
		 * @param {Batch} batch
		 */
		function commit(batch) {
			if ((state.effect.f & DESTROYED) !== 0) {
				return;
			}

			state.pending.delete(batch);

			state.fallback = fallback;
			reconcile(state, array, anchor, flags, get_key);

			if (fallback !== null) {
				if (array.length === 0) {
					if ((fallback.f & EFFECT_OFFSCREEN) === 0) {
						resume_effect(fallback);
					} else {
						fallback.f ^= EFFECT_OFFSCREEN;
						move(fallback, null, anchor);
					}
				} else {
					pause_effect(fallback, () => {
						// TODO only null out if no pending batch needs it,
						// otherwise re-add `fallback.fragment` and move the
						// effect into it
						fallback = null;
					});
				}
			}
		}

		var effect = block(() => {
			array = /** @type {V[]} */ (get(each_array));
			var length = array.length;

			var keys = new Set();
			var batch = /** @type {Batch} */ (current_batch);

			for (var index = 0; index < length; index += 1) {

				var value = array[index];
				var key = get_key(value, index);

				var item = first_run ? null : items.get(key);

				if (item) {
					// update before reconciliation, to trigger any async updates
					if (item.v) internal_set(item.v, value);
					if (item.i) internal_set(item.i, index);
				} else {
					item = create_item(
						items,
						first_run ? anchor : (offscreen_anchor ??= create_text()),
						value,
						key,
						index,
						render_fn,
						flags,
						get_collection
					);

					if (!first_run) {
						item.e.f |= EFFECT_OFFSCREEN;
					}

					items.set(key, item);
				}

				keys.add(key);
			}

			if (length === 0 && fallback_fn && !fallback) {
				if (first_run) {
					fallback = branch(() => fallback_fn(anchor));
				} else {
					fallback = branch(() => fallback_fn((offscreen_anchor ??= create_text())));
					fallback.f |= EFFECT_OFFSCREEN;
				}
			}

			if (length > keys.size) {
				{
					// in prod, the additional information isn't printed, so don't bother computing it
					each_key_duplicate();
				}
			}

			if (!first_run) {
				pending.set(batch, keys);

				{
					commit(batch);
				}
			}

			// When we mount the each block for the first time, the collection won't be
			// connected to this effect as the effect hasn't finished running yet and its deps
			// won't be assigned. However, it's possible that when reconciling the each block
			// that a mutation occurred and it's made the collection MAYBE_DIRTY, so reading the
			// collection again can provide consistency to the reactive graph again as the deriveds
			// will now be `CLEAN`.
			get(each_array);
		});

		/** @type {EachState} */
		var state = { effect, items, pending, outrogroups: null, fallback };

		first_run = false;
	}

	/**
	 * Skip past any non-branch effects (which could be created with `createSubscriber`, for example) to find the next branch effect
	 * @param {Effect | null} effect
	 * @returns {Effect | null}
	 */
	function skip_to_branch(effect) {
		while (effect !== null && (effect.f & BRANCH_EFFECT) === 0) {
			effect = effect.next;
		}
		return effect;
	}

	/**
	 * Add, remove, or reorder items output by an each block as its input changes
	 * @template V
	 * @param {EachState} state
	 * @param {Array<V>} array
	 * @param {Element | Comment | Text} anchor
	 * @param {number} flags
	 * @param {(value: V, index: number) => any} get_key
	 * @returns {void}
	 */
	function reconcile(state, array, anchor, flags, get_key) {
		var is_animated = (flags & EACH_IS_ANIMATED) !== 0;

		var length = array.length;
		var items = state.items;
		var current = skip_to_branch(state.effect.first);

		/** @type {undefined | Set<Effect>} */
		var seen;

		/** @type {Effect | null} */
		var prev = null;

		/** @type {undefined | Set<Effect>} */
		var to_animate;

		/** @type {Effect[]} */
		var matched = [];

		/** @type {Effect[]} */
		var stashed = [];

		/** @type {V} */
		var value;

		/** @type {any} */
		var key;

		/** @type {Effect | undefined} */
		var effect;

		/** @type {number} */
		var i;

		if (is_animated) {
			for (i = 0; i < length; i += 1) {
				value = array[i];
				key = get_key(value, i);
				effect = /** @type {EachItem} */ (items.get(key)).e;

				// offscreen == coming in now, no animation in that case,
				// else this would happen https://github.com/sveltejs/svelte/issues/17181
				if ((effect.f & EFFECT_OFFSCREEN) === 0) {
					effect.nodes?.a?.measure();
					(to_animate ??= new Set()).add(effect);
				}
			}
		}

		for (i = 0; i < length; i += 1) {
			value = array[i];
			key = get_key(value, i);

			effect = /** @type {EachItem} */ (items.get(key)).e;

			if (state.outrogroups !== null) {
				for (const group of state.outrogroups) {
					group.pending.delete(effect);
					group.done.delete(effect);
				}
			}

			if ((effect.f & INERT) !== 0) {
				resume_effect(effect);
				if (is_animated) {
					effect.nodes?.a?.unfix();
					(to_animate ??= new Set()).delete(effect);
				}
			}

			if ((effect.f & EFFECT_OFFSCREEN) !== 0) {
				effect.f ^= EFFECT_OFFSCREEN;

				if (effect === current) {
					move(effect, null, anchor);
				} else {
					var next = prev ? prev.next : current;

					if (effect === state.effect.last) {
						state.effect.last = effect.prev;
					}

					if (effect.prev) effect.prev.next = effect.next;
					if (effect.next) effect.next.prev = effect.prev;
					link(state, prev, effect);
					link(state, effect, next);

					move(effect, next, anchor);
					prev = effect;

					matched = [];
					stashed = [];

					current = skip_to_branch(prev.next);
					continue;
				}
			}

			if (effect !== current) {
				if (seen !== undefined && seen.has(effect)) {
					if (matched.length < stashed.length) {
						// more efficient to move later items to the front
						var start = stashed[0];
						var j;

						prev = start.prev;

						var a = matched[0];
						var b = matched[matched.length - 1];

						for (j = 0; j < matched.length; j += 1) {
							move(matched[j], start, anchor);
						}

						for (j = 0; j < stashed.length; j += 1) {
							seen.delete(stashed[j]);
						}

						link(state, a.prev, b.next);
						link(state, prev, a);
						link(state, b, start);

						current = start;
						prev = b;
						i -= 1;

						matched = [];
						stashed = [];
					} else {
						// more efficient to move earlier items to the back
						seen.delete(effect);
						move(effect, current, anchor);

						link(state, effect.prev, effect.next);
						link(state, effect, prev === null ? state.effect.first : prev.next);
						link(state, prev, effect);

						prev = effect;
					}

					continue;
				}

				matched = [];
				stashed = [];

				while (current !== null && current !== effect) {
					(seen ??= new Set()).add(current);
					stashed.push(current);
					current = skip_to_branch(current.next);
				}

				if (current === null) {
					continue;
				}
			}

			if ((effect.f & EFFECT_OFFSCREEN) === 0) {
				matched.push(effect);
			}

			prev = effect;
			current = skip_to_branch(effect.next);
		}

		if (state.outrogroups !== null) {
			for (const group of state.outrogroups) {
				if (group.pending.size === 0) {
					destroy_effects(state, array_from(group.done));
					state.outrogroups?.delete(group);
				}
			}

			if (state.outrogroups.size === 0) {
				state.outrogroups = null;
			}
		}

		if (current !== null || seen !== undefined) {
			/** @type {Effect[]} */
			var to_destroy = [];

			if (seen !== undefined) {
				for (effect of seen) {
					if ((effect.f & INERT) === 0) {
						to_destroy.push(effect);
					}
				}
			}

			while (current !== null) {
				// If the each block isn't inert, then inert effects are currently outroing and will be removed once the transition is finished
				if ((current.f & INERT) === 0 && current !== state.fallback) {
					to_destroy.push(current);
				}

				current = skip_to_branch(current.next);
			}

			var destroy_length = to_destroy.length;

			if (destroy_length > 0) {
				var controlled_anchor = (flags & EACH_IS_CONTROLLED) !== 0 && length === 0 ? anchor : null;

				if (is_animated) {
					for (i = 0; i < destroy_length; i += 1) {
						to_destroy[i].nodes?.a?.measure();
					}

					for (i = 0; i < destroy_length; i += 1) {
						to_destroy[i].nodes?.a?.fix();
					}
				}

				pause_effects(state, to_destroy, controlled_anchor);
			}
		}

		if (is_animated) {
			queue_micro_task(() => {
				if (to_animate === undefined) return;
				for (effect of to_animate) {
					effect.nodes?.a?.apply();
				}
			});
		}
	}

	/**
	 * @template V
	 * @param {Map<any, EachItem>} items
	 * @param {Node} anchor
	 * @param {V} value
	 * @param {unknown} key
	 * @param {number} index
	 * @param {(anchor: Node, item: V | Source<V>, index: number | Value<number>, collection: () => V[]) => void} render_fn
	 * @param {number} flags
	 * @param {() => V[]} get_collection
	 * @returns {EachItem}
	 */
	function create_item(items, anchor, value, key, index, render_fn, flags, get_collection) {
		var v =
			(flags & EACH_ITEM_REACTIVE) !== 0
				? (flags & EACH_ITEM_IMMUTABLE) === 0
					? mutable_source(value, false, false)
					: source(value)
				: null;

		var i = (flags & EACH_INDEX_REACTIVE) !== 0 ? source(index) : null;

		return {
			v,
			i,
			e: branch(() => {
				render_fn(anchor, v ?? value, i ?? index, get_collection);

				return () => {
					items.delete(key);
				};
			})
		};
	}

	/**
	 * @param {Effect} effect
	 * @param {Effect | null} next
	 * @param {Text | Element | Comment} anchor
	 */
	function move(effect, next, anchor) {
		if (!effect.nodes) return;

		var node = effect.nodes.start;
		var end = effect.nodes.end;

		var dest =
			next && (next.f & EFFECT_OFFSCREEN) === 0
				? /** @type {EffectNodes} */ (next.nodes).start
				: anchor;

		while (node !== null) {
			var next_node = /** @type {TemplateNode} */ (get_next_sibling(node));
			dest.before(node);

			if (node === end) {
				return;
			}

			node = next_node;
		}
	}

	/**
	 * @param {EachState} state
	 * @param {Effect | null} prev
	 * @param {Effect | null} next
	 */
	function link(state, prev, next) {
		if (prev === null) {
			state.effect.first = next;
		} else {
			prev.next = next;
		}

		if (next === null) {
			state.effect.last = prev;
		} else {
			next.prev = prev;
		}
	}

	/**
	 * @param {Node} anchor
	 * @param {{ hash: string, code: string }} css
	 */
	function append_styles$1(anchor, css) {
		// Use an effect to ensure `anchor` is in the DOM, otherwise getRootNode() will yield wrong results
		effect(() => {
			// Bit of a hack: branches.js/each.js use offscreen fragments with temporary text nodes that will
			// never be connected to the real dom. Therfore walk up to the branch that has created the component
			// whose styles we want to append, and check its node instead. It will be connected by the time we get here.
			anchor = active_effect?.parent?.nodes?.start ?? anchor;
			var root = anchor.getRootNode();

			var target = /** @type {ShadowRoot} */ (root).host
				? /** @type {ShadowRoot} */ (root)
				: /** @type {Document} */ (root).head ?? /** @type {Document} */ (root.ownerDocument).head;

			// Always querying the DOM is roughly the same perf as additionally checking for presence in a map first assuming
			// that you'll get cache hits half of the time, so we just always query the dom for simplicity and code savings.
			if (!target.querySelector('#' + css.hash)) {
				const style = create_element('style');
				style.id = css.hash;
				style.textContent = css.code;

				target.appendChild(style);
			}
		});
	}

	const whitespace = [...' \t\n\r\f\u00a0\u000b\ufeff'];

	/**
	 * @param {any} value
	 * @param {string | null} [hash]
	 * @param {Record<string, boolean>} [directives]
	 * @returns {string | null}
	 */
	function to_class(value, hash, directives) {
		var classname = value == null ? '' : '' + value;

		if (hash) {
			classname = classname ? classname + ' ' + hash : hash;
		}

		if (directives) {
			for (var key of Object.keys(directives)) {
				if (directives[key]) {
					classname = classname ? classname + ' ' + key : key;
				} else if (classname.length) {
					var len = key.length;
					var a = 0;

					while ((a = classname.indexOf(key, a)) >= 0) {
						var b = a + len;

						if (
							(a === 0 || whitespace.includes(classname[a - 1])) &&
							(b === classname.length || whitespace.includes(classname[b]))
						) {
							classname = (a === 0 ? '' : classname.substring(0, a)) + classname.substring(b + 1);
						} else {
							a = b;
						}
					}
				}
			}
		}

		return classname === '' ? null : classname;
	}

	/**
	 *
	 * @param {Record<string,any>} styles
	 * @param {boolean} important
	 */
	function append_styles(styles, important = false) {
		var separator = important ? ' !important;' : ';';
		var css = '';

		for (var key of Object.keys(styles)) {
			var value = styles[key];
			if (value != null && value !== '') {
				css += ' ' + key + ': ' + value + separator;
			}
		}

		return css;
	}

	/**
	 * @param {any} value
	 * @param {Record<string, any> | [Record<string, any>, Record<string, any>]} [styles]
	 * @returns {string | null}
	 */
	function to_style(value, styles) {
		if (styles) {
			var new_style = '';

			/** @type {Record<string,any> | undefined} */
			var normal_styles;

			/** @type {Record<string,any> | undefined} */
			var important_styles;

			if (Array.isArray(styles)) {
				normal_styles = styles[0];
				important_styles = styles[1];
			} else {
				normal_styles = styles;
			}

			if (normal_styles) {
				new_style += append_styles(normal_styles);
			}

			if (important_styles) {
				new_style += append_styles(important_styles, true);
			}

			new_style = new_style.trim();
			return new_style === '' ? null : new_style;
		}

		return String(value);
	}

	/**
	 * @param {Element} dom
	 * @param {boolean | number} is_html
	 * @param {string | null} value
	 * @param {string} [hash]
	 * @param {Record<string, any>} [prev_classes]
	 * @param {Record<string, any>} [next_classes]
	 * @returns {Record<string, boolean> | undefined}
	 */
	function set_class(dom, is_html, value, hash, prev_classes, next_classes) {
		var prev = /** @type {any} */ (dom)[CLASS_CACHE];

		if (
			prev !== value ||
			prev === undefined // for edge case of `class={undefined}`
		) {
			var next_class_name = to_class(value, hash, next_classes);

			{
				// Removing the attribute when the value is only an empty string causes
				// performance issues vs simply making the className an empty string. So
				// we should only remove the class if the value is nullish
				// and there no hash/directives :
				if (next_class_name == null) {
					dom.removeAttribute('class');
				} else {
					dom.className = next_class_name;
				}
			}

			/** @type {any} */ (dom)[CLASS_CACHE] = value;
		} else if (next_classes && prev_classes !== next_classes) {
			for (var key in next_classes) {
				var is_present = !!next_classes[key];

				if (prev_classes == null || is_present !== !!prev_classes[key]) {
					dom.classList.toggle(key, is_present);
				}
			}
		}

		return next_classes;
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} dom
	 * @param {Record<string, any>} prev
	 * @param {Record<string, any>} next
	 * @param {string} [priority]
	 */
	function update_styles(dom, prev = {}, next, priority) {
		for (var key in next) {
			var value = next[key];

			if (prev[key] !== value) {
				if (next[key] == null) {
					dom.style.removeProperty(key);
				} else {
					dom.style.setProperty(key, value, priority);
				}
			}
		}
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} dom
	 * @param {string | null} value
	 * @param {Record<string, any> | [Record<string, any>, Record<string, any>]} [prev_styles]
	 * @param {Record<string, any> | [Record<string, any>, Record<string, any>]} [next_styles]
	 */
	function set_style(dom, value, prev_styles, next_styles) {
		var prev = /** @type {any} */ (dom)[STYLE_CACHE];

		if (prev !== value) {
			var next_style_attr = to_style(value, next_styles);

			{
				if (next_style_attr == null) {
					dom.removeAttribute('style');
				} else {
					dom.style.cssText = next_style_attr;
				}
			}

			/** @type {any} */ (dom)[STYLE_CACHE] = value;
		} else if (next_styles) {
			if (Array.isArray(next_styles)) {
				update_styles(dom, prev_styles?.[0], next_styles[0]);
				update_styles(dom, prev_styles?.[1], next_styles[1], 'important');
			} else {
				update_styles(dom, prev_styles, next_styles);
			}
		}

		return next_styles;
	}

	/** @import { Blocker, Effect } from '#client' */

	const IS_CUSTOM_ELEMENT = Symbol('is custom element');
	const IS_HTML = Symbol('is html');
	const PROGRESS_TAG = IS_XHTML ? 'progress' : 'PROGRESS';

	/**
	 * @param {Element} element
	 * @param {any} value
	 */
	function set_value(element, value) {
		var attributes = get_attributes(element);

		if (
			attributes.value ===
				(attributes.value =
					// treat null and undefined the same for the initial value
					value ?? undefined) ||
			// @ts-expect-error
			// `progress` elements always need their value set when it's `0`
			(element.value === value && (value !== 0 || element.nodeName !== PROGRESS_TAG))
		) {
			return;
		}

		// @ts-expect-error
		element.value = value ?? '';
	}

	/**
	 * @param {Element} element
	 * @param {boolean} checked
	 */
	function set_checked(element, checked) {
		var attributes = get_attributes(element);

		if (
			attributes.checked ===
			(attributes.checked =
				// treat null and undefined the same for the initial value
				checked ?? undefined)
		) {
			return;
		}

		// @ts-expect-error
		element.checked = checked;
	}

	/**
	 * @param {Element} element
	 * @param {string} attribute
	 * @param {string | null} value
	 * @param {boolean} [skip_warning]
	 */
	function set_attribute(element, attribute, value, skip_warning) {
		var attributes = get_attributes(element);

		if (attributes[attribute] === (attributes[attribute] = value)) return;

		if (attribute === 'loading') {
			// @ts-expect-error
			element[LOADING_ATTR_SYMBOL] = value;
		}

		if (value == null) {
			element.removeAttribute(attribute);
		} else if (typeof value !== 'string' && get_setters(element).has(attribute)) {
			// @ts-ignore
			element[attribute] = value;
		} else {
			element.setAttribute(attribute, value);
		}
	}

	/**
	 *
	 * @param {Element} element
	 */
	function get_attributes(element) {
		return /** @type {Record<string | symbol, unknown>} **/ (
			/** @type {any} */ (element)[ATTRIBUTES_CACHE] ??= {
				[IS_CUSTOM_ELEMENT]: element.nodeName.includes('-'),
				[IS_HTML]: element.namespaceURI === NAMESPACE_HTML
			}
		);
	}

	/** @type {Map<string, Set<string>>} */
	var setters_cache = new Map();

	/** @param {Element} element */
	function get_setters(element) {
		var cache_key = element.getAttribute('is') || element.nodeName;
		var setters = setters_cache.get(cache_key);
		if (setters) return setters;
		setters_cache.set(cache_key, (setters = new Set()));

		var descriptors;
		var proto = element; // In the case of custom elements there might be setters on the instance
		var element_proto = Element.prototype;

		// Stop at Element, from there on there's only unnecessary (and dangerous, like innerHTML) setters we're not interested in
		// Do not use constructor.name here as that's unreliable in some browser environments
		while (element_proto !== proto) {
			descriptors = get_descriptors(proto);

			for (var key in descriptors) {
				if (
					descriptors[key].set &&
					// better safe than sorry, we don't want spread attributes to mess with HTML content
					key !== 'innerHTML' &&
					key !== 'textContent' &&
					key !== 'innerText'
				) {
					setters.add(key);
				}
			}

			proto = get_prototype_of(proto);
		}

		return setters;
	}

	/** @import { Batch } from '../../../reactivity/batch.js' */

	/**
	 * @param {HTMLInputElement} input
	 * @param {() => unknown} get
	 * @param {(value: unknown) => void} set
	 * @returns {void}
	 */
	function bind_value(input, get, set = get) {
		var batches = new WeakSet();

		listen_to_event_and_reset_event(input, 'input', async (is_reset) => {

			/** @type {any} */
			var value = is_reset ? input.defaultValue : input.value;
			value = is_numberlike_input(input) ? to_number(value) : value;
			set(value);

			if (current_batch !== null) {
				batches.add(current_batch);
			}

			// Because `{#each ...}` blocks work by updating sources inside the flush,
			// we need to wait a tick before checking to see if we should forcibly
			// update the input and reset the selection state
			await tick();

			// Respect any validation in accessors
			if (value !== (value = get())) {
				var start = input.selectionStart;
				var end = input.selectionEnd;
				var length = input.value.length;

				// the value is coerced on assignment
				input.value = value ?? '';

				// Restore selection
				if (end !== null) {
					var new_length = input.value.length;
					// If cursor was at end and new input is longer, move cursor to new end
					if (start === end && end === length && new_length > length) {
						input.selectionStart = new_length;
						input.selectionEnd = new_length;
					} else {
						input.selectionStart = start;
						input.selectionEnd = Math.min(end, new_length);
					}
				}
			}
		});

		if (
			// If we are hydrating and the value has since changed,
			// then use the updated value from the input instead.
			// If defaultValue is set, then value == defaultValue
			// TODO Svelte 6: remove input.value check and set to empty string?
			(untrack(get) == null && input.value)
		) {
			set(is_numberlike_input(input) ? to_number(input.value) : input.value);

			if (current_batch !== null) {
				batches.add(current_batch);
			}
		}

		render_effect(() => {

			var value = get();

			if (input === document.activeElement) {
				// In sync mode render effects are executed during tree traversal -> needs current_batch
				// In async mode render effects are flushed once batch resolved, at which point current_batch is null -> needs previous_batch
				var batch = /** @type {Batch} */ (current_batch);

				// Never rewrite the contents of a focused input. We can get here if, for example,
				// an update is deferred because of async work depending on the input:
				//
				// <input bind:value={query}>
				// <p>{await find(query)}</p>
				if (batches.has(batch)) {
					return;
				}
			}

			if (is_numberlike_input(input) && value === to_number(input.value)) {
				// handles 0 vs 00 case (see https://github.com/sveltejs/svelte/issues/9959)
				return;
			}

			if (input.type === 'date' && !value && !input.value) {
				// Handles the case where a temporarily invalid date is set (while typing, for example with a leading 0 for the day)
				// and prevents this state from clearing the other parts of the date input (see https://github.com/sveltejs/svelte/issues/7897)
				return;
			}

			// don't set the value of the input if it's the same to allow
			// minlength to work properly
			if (value !== input.value) {
				// @ts-expect-error the value is coerced on assignment
				input.value = value ?? '';
			}
		});
	}

	/**
	 * @param {HTMLInputElement} input
	 */
	function is_numberlike_input(input) {
		var type = input.type;
		return type === 'number' || type === 'range';
	}

	/**
	 * @param {string} value
	 */
	function to_number(value) {
		return value === '' ? null : +value;
	}

	/** @import { ComponentContext, Effect } from '#client' */

	/**
	 * @param {any} bound_value
	 * @param {Element} element_or_component
	 * @returns {boolean}
	 */
	function is_bound_this(bound_value, element_or_component) {
		return (
			bound_value === element_or_component || bound_value?.[STATE_SYMBOL] === element_or_component
		);
	}

	/**
	 * @param {any} element_or_component
	 * @param {(value: unknown, ...parts: unknown[]) => void} update
	 * @param {(...parts: unknown[]) => unknown} get_value
	 * @param {() => unknown[]} [get_parts] Set if the this binding is used inside an each block,
	 * 										returns all the parts of the each block context that are used in the expression
	 * @returns {void}
	 */
	function bind_this(
		element_or_component = mark_as_component(),
		update,
		get_value,
		get_parts
	) {
		var component_effect = /** @type {ComponentContext} */ (component_context).r;
		var parent = /** @type {Effect} */ (active_effect);

		effect(() => {
			/** @type {unknown[]} */
			var old_parts;

			/** @type {unknown[]} */
			var parts;

			render_effect(() => {
				old_parts = parts;
				// We only track changes to the parts, not the value itself to avoid unnecessary reruns.
				parts = [];

				untrack(() => {
					if (!is_bound_this(get_value(...parts), element_or_component)) {
						update(element_or_component, ...parts);
						// If this is an effect rerun (cause: each block context changes), then nullify the binding at
						// the previous position if it isn't already taken over by a different effect.
						if (old_parts && is_bound_this(get_value(...old_parts), element_or_component)) {
							update(null, ...old_parts);
						}
					}
				});
			});

			return () => {
				// When the bind:this effect is destroyed, we go up the effect parent chain until we find the last parent effect that is destroyed,
				// or the effect containing the component bind:this is in (whichever comes first). That way we can time the nulling of the binding
				// as close to user/developer expectation as possible.
				// TODO Svelte 6: Decide if we want to keep this logic or just always null the binding in the component effect's teardown
				// (which would be simpler, but less intuitive in some cases, and breaks the `ondestroy-before-cleanup` test)
				let p = parent;
				while (p !== component_effect && p.parent !== null && p.parent.f & DESTROYING) {
					p = p.parent;
				}
				const teardown = () => {
					if (parts && is_bound_this(get_value(...parts), element_or_component)) {
						update(null, ...parts);
					}
				};
				const original_teardown = p.teardown;
				p.teardown = () => {
					teardown();
					original_teardown?.();
				};
			};
		});

		return element_or_component;
	}

	/** @import { Derived, Effect, Source } from './types.js' */

	/**
	 * This function is responsible for synchronizing a possibly bound prop with the inner component state.
	 * It is used whenever the compiler sees that the component writes to the prop, or when it has a default prop_value.
	 * @template V
	 * @param {Record<string, unknown>} props
	 * @param {string} key
	 * @param {number} flags
	 * @param {V | (() => V)} [fallback]
	 * @returns {(() => V | ((arg: V) => V) | ((arg: V, mutation: boolean) => V))}
	 */
	function prop(props, key, flags, fallback) {

		var fallback_value = /** @type {V} */ (fallback);
		var fallback_dirty = true;

		var get_fallback = () => {

			if (fallback_dirty) {
				fallback_dirty = false;

				fallback_value = /** @type {V} */ (fallback);
			}

			return fallback_value;
		};

		/** @type {V} */
		var initial_value;

		{
			initial_value = /** @type {V} */ (props[key]);
		}

		if (initial_value === undefined && fallback !== undefined) {
			initial_value = get_fallback();
		}

		/** @type {() => V} */
		var getter;

		{
			getter = () => {
				var value = /** @type {V} */ (props[key]);
				if (value === undefined) return get_fallback();
				fallback_dirty = true;
				return value;
			};
		}

		// prop is never written to — we only need a getter
		{
			return getter;
		}
	}

	function pageGlobal(name) {
	  const page = _unsafeWindow;
	  return page?.[name] ?? globalThis[name];
	}

	function t(key, fallback, data) {
	  try {
	    const translated = localizationHandler.translate(key, data);
	    return translated && translated !== key ? translated : fallback;
	  } catch {
	    return fallback;
	  }
	}
	function isCommunityMode(settings) {
	  return settings.gameMode === "Community" || settings.gameMode === "Themed";
	}
	function modeOf(settings) {
	  if (isCommunityMode(settings)) return "community";
	  if (settings.showSelection === 2) return "battle-royale";
	  if (settings.scoreType === 2) return "hint";
	  if (settings.scoreType === 4) return "last-man-standing";
	  if (settings.scoreType === 3) return "quick-draw";
	  if (settings.scoreType === 5) return "boss-fight";
	  if (settings.gameMode === "event-hosted") return "amq-awards";
	  return "standard";
	}
	const MODE_KEYS = {
	  standard: ["standard", "Standard"],
	  community: ["community", "Community"],
	  "battle-royale": ["battle_royale", "Battle Royale"],
	  hint: ["hint", "Hint"],
	  "last-man-standing": ["last_man_standing", "Last Man"],
	  "quick-draw": ["quick_draw", "Quick Draw"],
	  "boss-fight": ["boss_fight", "Boss Fight"],
	  "amq-awards": ["amq_awards", "AMQ Awards"]
	};
	function modeLabel(mode) {
	  const [key, fallback] = MODE_KEYS[mode];
	  return t(`room_browser.room_tile.game_mode.${key}`, fallback);
	}
	function modeTone(mode) {
	  switch (mode) {
	    case "last-man-standing":
	      return "teal";
	    case "quick-draw":
	      return "amber";
	    case "hint":
	    case "amq-awards":
	      return "violet";
	    case "battle-royale":
	    case "community":
	      return "cyan";
	    case "boss-fight":
	      return "rose";
	    default:
	      return "blue";
	  }
	}
	function songTypesOf(settings) {
	  if (isCommunityMode(settings)) {
	    return { openings: true, endings: true, inserts: true };
	  }
	  const { standardValue: std, advancedValue: adv } = settings.songType;
	  return {
	    openings: Boolean(std.openings && (adv.openings || adv.random)),
	    endings: Boolean(std.endings && (adv.endings || adv.random)),
	    inserts: Boolean(std.inserts && (adv.inserts || adv.random))
	  };
	}
	function songSelectionOf(settings) {
	  if (isCommunityMode(settings)) return "custom";
	  const selection = settings.songSelection;
	  if (selection?.advancedOn) return "custom";
	  switch (selection?.standardValue) {
	    case 1:
	      return "random";
	    case 2:
	      return "mix";
	    case 3:
	      return "watched";
	    default:
	      return "custom";
	  }
	}
	function songSelectionLabel$1(selection) {
	  const fallbacks = {
	    random: "Random",
	    mix: "Mixed",
	    watched: "Watched",
	    custom: "Custom"
	  };
	  return t(
	    `room_browser.room_tile.song_selection.${selection}`,
	    fallbacks[selection]
	  );
	}
	function songSelectionTone(selection) {
	  switch (selection) {
	    case "watched":
	      return "teal";
	    case "random":
	      return "violet";
	    case "mix":
	      return "amber";
	    default:
	      return "blue";
	  }
	}
	function guessTimeOf(settings) {
	  if (isCommunityMode(settings)) return { range: null, extra: null };
	  return {
	    range: rangeOf(settings.guessTime),
	    extra: positiveRange(settings.extraGuessTime)
	  };
	}
	function rangeOf(setting) {
	  if (!setting) return null;
	  return setting.randomOn ? { min: setting.randomValue[0], max: setting.randomValue[1] } : { min: setting.standardValue, max: setting.standardValue };
	}
	function positiveRange(setting) {
	  const range = rangeOf(setting);
	  return range && range.max > 0 ? range : null;
	}
	function rangeLabel(range) {
	  return range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
	}
	const DIFFICULTY_TIERS = [
	  { key: "expert", min: 0, max: 15, colour: "#e5658a" },
	  { key: "hard", min: 15, max: 25, colour: "#ef8a5a" },
	  { key: "medium", min: 25, max: 50, colour: "#e8b84d" },
	  { key: "easy", min: 50, max: 70, colour: "#93c96b" },
	  { key: "beginner", min: 70, max: 100, colour: "#34c9a3" }
	];
	const TIER_FALLBACKS = {
	  expert: "Expert",
	  hard: "Hard",
	  medium: "Medium",
	  easy: "Easy",
	  beginner: "Beginner"
	};
	function tierLabel(tier) {
	  return t(
	    `game_settings.song_difficulty.${tier.key}`,
	    TIER_FALLBACKS[tier.key]
	  );
	}
	function difficultyRange(settings) {
	  const difficulty = settings.songDifficulity;
	  if (!difficulty) return { min: 0, max: 100 };
	  if (difficulty.advancedOn) {
	    const [min2, max2] = difficulty.advancedValue;
	    return { min: min2, max: max2 };
	  }
	  let min = 100;
	  let max = 0;
	  for (const tier of DIFFICULTY_TIERS) {
	    if (difficulty.standardValue?.[tier.key]) {
	      min = Math.min(min, tier.min);
	      max = Math.max(max, tier.max);
	    }
	  }
	  return min > max ? { min: 0, max: 100 } : { min, max };
	}
	function tiersTouched(range) {
	  return DIFFICULTY_TIERS.filter(
	    (tier) => tier.max > range.min && tier.min < range.max
	  );
	}
	function defaults() {
	  try {
	    return hostModal?.DEFUALT_SETTINGS ?? {};
	  } catch {
	    return {};
	  }
	}
	function genreTagName(id, kind) {
	  let name;
	  try {
	    name = kind === "genre" ? idTranslator.genreNames[id] : idTranslator.tagNames[id];
	  } catch {
	    name = void 0;
	  }
	  if (!name) return `#${id}`;
	  try {
	    const key = kind === "genre" ? localizationHandler.convertAnimeGenreToKey(name) : localizationHandler.convertAnimeTagToKey(name);
	    return t(key, name);
	  } catch {
	    return name;
	  }
	}
	const MODIFIER_CHIPS = [
	  {
	    key: "dubSongs",
	    on: ["DUB", "Dub songs allowed (legacy setting, limited pool)"],
	    off: ["NO DUB", "Dub songs are excluded"]
	  },
	  {
	    key: "fullSongRange",
	    on: ["FULL", "Full song range — songs can play to the very end"],
	    off: ["NO FULL", "Songs do not play to the very end"]
	  },
	  {
	    key: "duplicates",
	    on: ["DUP", "Duplicate shows — one show can supply several songs"],
	    off: ["NO DUP", "No duplicate shows — each show supplies at most one song"]
	  },
	  {
	    key: "rebroadcastSongs",
	    on: ["RBC", "Rebroadcast songs allowed"],
	    off: ["NO RBC", "Rebroadcast songs are excluded"]
	  },
	  {
	    key: "quizJoin",
	    on: ["JOIN", "Quiz join — players may join after the quiz has started"],
	    off: ["NO JOIN", "Players cannot join once the quiz has started"]
	  },
	  {
	    key: "lootDropping",
	    on: [
	      "LOOT",
	      "Loot dropping — players can drop collected shows while looting"
	    ],
	    off: ["NO LOOT", "Players cannot drop collected shows while looting"]
	  }
	];
	const SONG_POOL_LABELS = {
	  1: ["POOL:ALL", "Song pool — every song in the database"],
	  2: ["POOL:LIST", "Song pool — only songs from players’ lists"],
	  3: ["POOL:COM", "Song pool — community-uploaded songs"]
	};
	const DISTRIBUTION_LABELS = {
	  1: ["DIST:RND", "Watched distribution — random"],
	  2: [
	    "DIST:WGT",
	    "Watched distribution — weighted by how many players watched"
	  ],
	  3: ["DIST:EQ", "Watched distribution — equal per player"]
	};
	const SONG_CATEGORIES = {
	  standard: { short: "STD", name: "Standard" },
	  instrumental: { short: "INS", name: "Instrumental" },
	  chanting: { short: "CHA", name: "Chanting" },
	  character: { short: "CHR", name: "Character" }
	};
	function categoryName(key) {
	  const entry = SONG_CATEGORIES[key];
	  return t(`game_settings.song_categories.${key}.title`, entry?.name ?? key);
	}
	const SONG_TYPE_NAMES = {
	  OP: ["room_browser.room_tile.song_types.opening", "Opening"],
	  ED: ["room_browser.room_tile.song_types.ending", "Ending"],
	  IN: ["room_browser.room_tile.song_types.insert", "Insert"]
	};
	const PLAYBACK_SPEEDS = ["0.5", "1", "1.5", "2"];
	function chipsFor(settings) {
	  const chips = [];
	  const base = defaults();
	  const push = (chip) => chips.push(chip);
	  if (settings.songPool != null && settings.songPool !== base.songPool) {
	    const entry = SONG_POOL_LABELS[settings.songPool];
	    if (entry) {
	      push({ id: "pool", label: entry[0], tone: "teal", tooltip: entry[1] });
	    }
	  }
	  if (settings.watchedDistribution != null && settings.watchedDistribution !== base.watchedDistribution) {
	    const entry = DISTRIBUTION_LABELS[settings.watchedDistribution];
	    if (entry) {
	      push({ id: "dist", label: entry[0], tone: "teal", tooltip: entry[1] });
	    }
	  }
	  for (const [prefix, key] of [
	    ["OP", "openingCategories"],
	    ["ED", "endingCategories"],
	    ["IN", "insertCategories"]
	  ]) {
	    const value = settings[key];
	    const fallback = base[key];
	    if (!value || !fallback) continue;
	    const off = Object.keys(fallback).filter(
	      (name) => fallback[name] && !value[name]
	    );
	    if (!off.length) continue;
	    const kept = Object.keys(value).filter(
	      (name) => value[name]
	    );
	    const [typeKey, typeFallback] = SONG_TYPE_NAMES[prefix];
	    const songType = t(typeKey, typeFallback);
	    push({
	      id: `cat-${key}`,
	      label: `${prefix}:${kept.map((name) => SONG_CATEGORIES[name]?.short ?? name.toUpperCase()).join("/") || "NONE"}`,
	      tone: "teal",
	      tooltip: kept.length ? `${songType} songs limited to ${kept.map(categoryName).join(", ")}` : `No ${songType.toLowerCase()} song categories are enabled`
	    });
	  }
	  const modifiers = settings.modifiers;
	  const baseModifiers = base.modifiers;
	  if (modifiers && baseModifiers) {
	    for (const entry of MODIFIER_CHIPS) {
	      const on = modifiers[entry.key];
	      if (on === baseModifiers[entry.key]) continue;
	      const [label, tooltip] = on ? entry.on : entry.off;
	      push({ id: `mod-${entry.key}`, label, tone: "amber", tooltip });
	    }
	  }
	  if (settings.vintage && changed(settings.vintage, base.vintage)) {
	    push({
	      id: "vintage",
	      label: vintageLabel$2(settings.vintage),
	      tone: "violet",
	      tooltip: `Vintage — ${vintageTooltip(settings.vintage)}`
	    });
	  }
	  if (settings.type && changed(settings.type, base.type)) {
	    const on = Object.keys(settings.type).filter(
	      (key) => settings.type[key]
	    );
	    push({
	      id: "type",
	      label: on.map((key) => key.toUpperCase()).join("/") || "NONE",
	      tone: "violet",
	      tooltip: `Anime type limited to: ${on.join(", ") || "nothing"}`
	    });
	  }
	  if (settings.animeScore && changed(settings.animeScore, base.animeScore)) {
	    const [min, max] = settings.animeScore.standardValue;
	    push({
	      id: "animeScore",
	      label: `★${min}–${max}`,
	      tone: "violet",
	      tooltip: `Anime score — shows rated ${min} to ${max}`
	    });
	  }
	  if (settings.songPopularity && changed(settings.songPopularity, base.songPopularity)) {
	    const on = Object.keys(settings.songPopularity.standardValue).filter(
	      (key) => settings.songPopularity.standardValue[key]
	    );
	    push({
	      id: "popularity",
	      label: `POP:${on.map((key) => key.slice(0, 3).toUpperCase()).join("/") || "NONE"}`,
	      tone: "violet",
	      tooltip: `Song popularity limited to: ${on.join(", ") || "nothing"}`
	    });
	  }
	  for (const [key, kind] of [
	    ["genre", "genre"],
	    ["tags", "tag"]
	  ]) {
	    for (const entry of settings[key] ?? []) {
	      const name = genreTagName(entry.id, kind);
	      const prefix = entry.state === 1 ? "+" : entry.state === 2 ? "−" : "~";
	      push({
	        id: `${key}-${entry.id}`,
	        label: `${prefix}${name}`,
	        tone: entry.state === 2 ? "rose" : "violet",
	        dashed: entry.state === 3,
	        tooltip: entry.state === 1 ? `Include — the show must have the ${name} ${kind}` : entry.state === 2 ? `Exclude — shows with the ${name} ${kind} are left out` : `Optional — a show must match at least one optional entry. ${name} is one of them.`
	      });
	    }
	  }
	  if (settings.teamSize != null && settings.teamSize > 1) {
	    push({
	      id: "teamSize",
	      label: `TEAM ${settings.teamSize}`,
	      tone: "blue",
	      tooltip: `Team size — ${settings.teamSize} players per team`
	    });
	  }
	  if (settings.scoreType === 5) {
	    if (settings.bossLives != null) {
	      push({
	        id: "bossLives",
	        label: `BOSS ${settings.bossLives}`,
	        tone: "blue",
	        tooltip: `Boss lives — each boss starts with ${settings.bossLives}`
	      });
	    }
	    if (settings.bossPowerUps != null) {
	      push({
	        id: "bossPowerUps",
	        label: `PWR×${settings.bossPowerUps}`,
	        tone: "blue",
	        tooltip: `Boss power-ups — ${settings.bossPowerUps} different ones available to the boss`
	      });
	    }
	  }
	  if (settings.scoreType === 4 && settings.lives != null && settings.lives !== base.lives) {
	    push({
	      id: "lives",
	      label: `♥${settings.lives}`,
	      tone: "blue",
	      tooltip: `Lives — each player starts with ${settings.lives}`
	    });
	  }
	  if (settings.showSelection === 2 && settings.inventorySize) {
	    const size = rangeOf(settings.inventorySize);
	    if (size) {
	      push({
	        id: "inventory",
	        label: `INV ${rangeLabel(size)}`,
	        tone: "blue",
	        tooltip: `Inventory size — ${rangeLabel(size)} shows carried during the looting phase`
	      });
	    }
	  }
	  if (settings.hintSetup && changed(settings.hintSetup, base.hintSetup)) {
	    push({
	      id: "hints",
	      label: "HINTS",
	      tone: "blue",
	      tooltip: `Non-default hint costs — song ${settings.hintSetup.songPoints}pt, name ${settings.hintSetup.nameCost}, info ${settings.hintSetup.infoCost}, choice ${settings.hintSetup.multipleChoiceCost}, audio ${settings.hintSetup.audioCost}`
	    });
	  }
	  if (settings.samplePoint && changed(settings.samplePoint, base.samplePoint)) {
	    const point = rangeOf(settings.samplePoint);
	    push({
	      id: "samplePoint",
	      label: `SMP ${point ? rangeLabel(point) : "?"}%`,
	      tone: "blue",
	      tooltip: `Sample point — songs start ${point ? rangeLabel(point) : "?"}% of the way in`
	    });
	  }
	  if (settings.playbackSpeed && changed(settings.playbackSpeed, base.playbackSpeed)) {
	    const speed = settings.playbackSpeed;
	    const label = speed.randomOn ? speed.randomValue.map((on, index) => on ? PLAYBACK_SPEEDS[index] : null).filter(Boolean).join("/") : PLAYBACK_SPEEDS[speed.standardValue - 1] ?? String(speed.standardValue);
	    push({
	      id: "playbackSpeed",
	      label: `×${label}`,
	      tone: "blue",
	      tooltip: `Playback speed — songs play at ×${label}`
	    });
	  }
	  return chips;
	}
	function isDefaultSetting(value, base) {
	  if (base === void 0 || value === void 0) return false;
	  const current = value;
	  const fallback = base;
	  if (current?.randomOn !== void 0) {
	    if (current.randomOn !== fallback.randomOn) return false;
	    return current.randomOn ? sameJson(current.randomValue, fallback.randomValue) : sameJson(current.standardValue, fallback.standardValue);
	  }
	  if (current?.advancedOn !== void 0) {
	    if (current.advancedOn !== fallback.advancedOn) return false;
	    return current.advancedOn ? sameJson(current.advancedValue, fallback.advancedValue) : sameJson(current.standardValue, fallback.standardValue);
	  }
	  return sameJson(current, fallback);
	}
	function sameJson(a, b) {
	  try {
	    return JSON.stringify(a) === JSON.stringify(b);
	  } catch {
	    return false;
	  }
	}
	function changed(value, base) {
	  return value !== void 0 && !isDefaultSetting(value, base);
	}
	const SEASONS = ["Winter", "Spring", "Summer", "Fall"];
	function vintageLabel$2(vintage) {
	  if (vintage.advancedValueList?.length) {
	    const years = vintage.advancedValueList.flatMap((entry) => entry.years);
	    return `${Math.min(...years)}–${Math.max(...years)}`;
	  }
	  const [from, to] = vintage.standardValue.years;
	  return from === to ? `${from}` : `${from}–${to}`;
	}
	function vintageTooltip(vintage) {
	  if (vintage.advancedValueList?.length) {
	    return vintage.advancedValueList.map(
	      (entry) => `${SEASONS[entry.seasons[0]]} ${entry.years[0]} – ${SEASONS[entry.seasons[1]]} ${entry.years[1]}`
	    ).join(", ");
	  }
	  const { years, seasons } = vintage.standardValue;
	  return `${SEASONS[seasons[0]]} ${years[0]} – ${SEASONS[seasons[1]]} ${years[1]}`;
	}
	function openProfile(target, name) {
	  const jquery = pageGlobal("$");
	  if (typeof jquery !== "function") {
	    console.error(
	      "[amq-ui] cannot open a profile: jQuery is not reachable from the page"
	    );
	    return;
	  }
	  try {
	    playerProfileController.loadProfileIfClosed(
	      name,
	      jquery(target),
	      { x: 7 },
	      () => {
	      }
	    );
	  } catch (error) {
	    console.error("[amq-ui] could not open profile for", name, error);
	  }
	}
	function avatarImage(hostAvatar) {
	  const avatar = hostAvatar?.avatar;
	  if (!avatar) return null;
	  const { avatarName, outfitName, optionName, optionActive, colorName } = avatar;
	  try {
	    return {
	      src: cdnFormater.newAvatarHeadSrc(
	        avatarName,
	        outfitName,
	        optionName,
	        optionActive,
	        colorName
	      ),
	      srcset: cdnFormater.newAvatarHeadSrcSet(
	        avatarName,
	        outfitName,
	        optionName,
	        optionActive,
	        colorName
	      ),
	      fallbackSrc: cdnFormater.newSizedAvatarSrc(
	        avatarName,
	        outfitName,
	        optionName,
	        optionActive,
	        colorName,
	        1,
	        250
	      ),
	      fallbackPosition: FALLBACK_POSITIONS[avatar.sizeModifier] ?? "50% 8%"
	    };
	  } catch {
	    return null;
	  }
	}
	const FALLBACK_POSITIONS = {
	  "0": "50% 6%",
	  "20": "50% 9%",
	  "51": "50% 12%"
	};

	/** @import { Source } from '#client' */

	var read_methods = ['forEach', 'isDisjointFrom', 'isSubsetOf', 'isSupersetOf'];
	var set_like_methods = ['difference', 'intersection', 'symmetricDifference', 'union'];

	var inited = false;

	/**
	 * A reactive version of the built-in [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) object.
	 * Reading contents of the set (by iterating, or by reading `set.size` or calling `set.has(...)` as in the [example](https://svelte.dev/playground/53438b51194b4882bcc18cddf9f96f15) below) in an [effect](https://svelte.dev/docs/svelte/$effect) or [derived](https://svelte.dev/docs/svelte/$derived)
	 * will cause it to be re-evaluated as necessary when the set is updated.
	 *
	 * Note that values in a reactive set are _not_ made [deeply reactive](https://svelte.dev/docs/svelte/$state#Deep-state).
	 *
	 * ```svelte
	 * <script>
	 * 	import { SvelteSet } from 'svelte/reactivity';
	 * 	let monkeys = new SvelteSet();
	 *
	 * 	function toggle(monkey) {
	 * 		if (monkeys.has(monkey)) {
	 * 			monkeys.delete(monkey);
	 * 		} else {
	 * 			monkeys.add(monkey);
	 * 		}
	 * 	}
	 * </script>
	 *
	 * {#each ['🙈', '🙉', '🙊'] as monkey}
	 * 	<button onclick={() => toggle(monkey)}>{monkey}</button>
	 * {/each}
	 *
	 * <button onclick={() => monkeys.clear()}>clear</button>
	 *
	 * {#if monkeys.has('🙈')}<p>see no evil</p>{/if}
	 * {#if monkeys.has('🙉')}<p>hear no evil</p>{/if}
	 * {#if monkeys.has('🙊')}<p>speak no evil</p>{/if}
	 * ```
	 *
	 * @template T
	 * @extends {Set<T>}
	 */
	class SvelteSet extends Set {
		/** @type {Map<T, Source<boolean>>} */
		#sources = new Map();
		#version = state(0);
		#size = state(0);
		#update_version = update_version || -1;

		/**
		 * @param {Iterable<T> | null | undefined} [value]
		 */
		constructor(value) {
			super();

			if (value) {
				for (var element of value) {
					super.add(element);
				}
				this.#size.v = super.size;
			}

			if (!inited) this.#init();
		}

		/**
		 * If the source is being created inside the same reaction as the SvelteSet instance,
		 * we use `state` so that it will not be a dependency of the reaction. Otherwise we
		 * use `source` so it will be.
		 *
		 * @template T
		 * @param {T} value
		 * @returns {Source<T>}
		 */
		#source(value) {
			return update_version === this.#update_version ? state(value) : source(value);
		}

		// We init as part of the first instance so that we can treeshake this class
		#init() {
			inited = true;

			var proto = SvelteSet.prototype;
			var set_proto = Set.prototype;

			for (const method of read_methods) {
				// @ts-ignore
				proto[method] = function (...v) {
					get(this.#version);
					// @ts-ignore
					return set_proto[method].apply(this, v);
				};
			}

			for (const method of set_like_methods) {
				// @ts-ignore
				proto[method] = function (...v) {
					get(this.#version);
					// @ts-ignore
					var set = /** @type {Set<T>} */ (set_proto[method].apply(this, v));
					return new SvelteSet(set);
				};
			}
		}

		/** @param {T} value */
		has(value) {
			var has = super.has(value);
			var sources = this.#sources;
			var s = sources.get(value);

			if (s === undefined) {
				if (!has) {
					// If the value doesn't exist, track the version in case it's added later
					// but don't create sources willy-nilly to track all possible values
					get(this.#version);
					return false;
				}

				s = this.#source(true);

				sources.set(value, s);
			}

			get(s);
			return has;
		}

		/** @param {T} value */
		add(value) {
			if (!super.has(value)) {
				super.add(value);
				set(this.#size, super.size);
				increment(this.#version);
			}

			return this;
		}

		/** @param {T} value */
		delete(value) {
			var deleted = super.delete(value);
			var sources = this.#sources;
			var s = sources.get(value);

			if (s !== undefined) {
				sources.delete(value);
				set(s, false);
			}

			if (deleted) {
				set(this.#size, super.size);
				increment(this.#version);
			}

			return deleted;
		}

		clear() {
			if (super.size === 0) {
				return;
			}
			// Clear first, so we get nice console.log outputs with $inspect
			super.clear();
			var sources = this.#sources;

			for (var s of sources.values()) {
				set(s, false);
			}

			sources.clear();
			set(this.#size, 0);
			increment(this.#version);
		}

		keys() {
			return this.values();
		}

		values() {
			get(this.#version);
			return super.values();
		}

		entries() {
			get(this.#version);
			return super.entries();
		}

		[Symbol.iterator]() {
			return this.keys();
		}

		get size() {
			return get(this.#size);
		}
	}

	/** @import { Source } from '#client' */

	/**
	 * A reactive version of the built-in [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) object.
	 * Reading contents of the map (by iterating, or by reading `map.size` or calling `map.get(...)` or `map.has(...)` as in the [tic-tac-toe example](https://svelte.dev/playground/0b0ff4aa49c9443f9b47fe5203c78293) below) in an [effect](https://svelte.dev/docs/svelte/$effect) or [derived](https://svelte.dev/docs/svelte/$derived)
	 * will cause it to be re-evaluated as necessary when the map is updated.
	 *
	 * Note that values in a reactive map are _not_ made [deeply reactive](https://svelte.dev/docs/svelte/$state#Deep-state).
	 *
	 * ```svelte
	 * <script>
	 * 	import { SvelteMap } from 'svelte/reactivity';
	 * 	import { result } from './game.js';
	 *
	 * 	let board = new SvelteMap();
	 * 	let player = $state('x');
	 * 	let winner = $derived(result(board));
	 *
	 * 	function reset() {
	 * 		player = 'x';
	 * 		board.clear();
	 * 	}
	 * </script>
	 *
	 * <div class="board">
	 * 	{#each Array(9), i}
	 * 		<button
	 * 			disabled={board.has(i) || winner}
	 * 			onclick={() => {
	 * 				board.set(i, player);
	 * 				player = player === 'x' ? 'o' : 'x';
	 * 			}}
	 * 		>{board.get(i)}</button>
	 * 	{/each}
	 * </div>
	 *
	 * {#if winner}
	 * 	<p>{winner} wins!</p>
	 * 	<button onclick={reset}>reset</button>
	 * {:else}
	 * 	<p>{player} is next</p>
	 * {/if}
	 * ```
	 *
	 * @template K
	 * @template V
	 * @extends {Map<K, V>}
	 */
	class SvelteMap extends Map {
		/** @type {Map<K, Source<number>>} */
		#sources = new Map();
		#version = state(0);
		#size = state(0);
		#update_version = update_version || -1;

		/**
		 * @param {Iterable<readonly [K, V]> | null | undefined} [value]
		 */
		constructor(value) {
			super();

			if (value) {
				for (var [key, v] of value) {
					super.set(key, v);
				}
				this.#size.v = super.size;
			}
		}

		/**
		 * If the source is being created inside the same reaction as the SvelteMap instance,
		 * we use `state` so that it will not be a dependency of the reaction. Otherwise we
		 * use `source` so it will be.
		 *
		 * @template T
		 * @param {T} value
		 * @returns {Source<T>}
		 */
		#source(value) {
			return update_version === this.#update_version ? state(value) : source(value);
		}

		/** @param {K} key */
		has(key) {
			var sources = this.#sources;
			var s = sources.get(key);

			if (s === undefined) {
				if (super.has(key)) {
					s = this.#source(0);

					sources.set(key, s);
				} else {
					// We should always track the version in case
					// the Set ever gets this value in the future.
					get(this.#version);
					return false;
				}
			}

			get(s);
			return true;
		}

		/**
		 * @param {(value: V, key: K, map: Map<K, V>) => void} callbackfn
		 * @param {any} [this_arg]
		 */
		forEach(callbackfn, this_arg) {
			this.#read_all();
			super.forEach(callbackfn, this_arg);
		}

		/** @param {K} key */
		get(key) {
			var sources = this.#sources;
			var s = sources.get(key);

			if (s === undefined) {
				if (super.has(key)) {
					s = this.#source(0);

					sources.set(key, s);
				} else {
					// We should always track the version in case
					// the Set ever gets this value in the future.
					get(this.#version);
					return undefined;
				}
			}

			get(s);
			return super.get(key);
		}

		/**
		 * @param {K} key
		 * @param {V} value
		 * */
		getOrInsert(key, value) {
			if (!super.has(key)) {
				this.set(key, value);
			}
			return /** @type {V} */ (this.get(key));
		}

		/**
		 * @param {K} key
		 * @param {(key: K) => V} callbackFn
		 */
		getOrInsertComputed(key, callbackFn) {
			if (!super.has(key)) {
				this.set(key, callbackFn(key));
			}
			return /** @type {V} */ (this.get(key));
		}

		/**
		 * @param {K} key
		 * @param {V} value
		 * */
		set(key, value) {
			var sources = this.#sources;
			var s = sources.get(key);
			var prev_res = super.get(key);
			var res = super.set(key, value);
			var version = this.#version;

			if (s === undefined) {
				s = this.#source(0);

				sources.set(key, s);
				set(this.#size, super.size);
				increment(version);
			} else if (prev_res !== value) {
				increment(s);

				// if not every reaction of s is a reaction of version we need to also include version
				var v_reactions = version.reactions === null ? null : new Set(version.reactions);
				var needs_version_increase =
					v_reactions === null ||
					!s.reactions?.every((r) =>
						/** @type {NonNullable<typeof v_reactions>} */ (v_reactions).has(r)
					);
				if (needs_version_increase) {
					increment(version);
				}
			}

			return res;
		}

		/** @param {K} key */
		delete(key) {
			var sources = this.#sources;
			var s = sources.get(key);
			var res = super.delete(key);

			if (s !== undefined) {
				sources.delete(key);
				set(s, -1);
			}

			if (res) {
				set(this.#size, super.size);
				increment(this.#version);
			}

			return res;
		}

		clear() {
			if (super.size === 0) {
				return;
			}
			// Clear first, so we get nice console.log outputs with $inspect
			super.clear();
			var sources = this.#sources;
			set(this.#size, 0);
			for (var s of sources.values()) {
				set(s, -1);
			}
			increment(this.#version);
			sources.clear();
		}

		#read_all() {
			get(this.#version);

			var sources = this.#sources;
			if (this.#size.v !== sources.size) {
				for (var key of super.keys()) {
					if (!sources.has(key)) {
						var s = this.#source(0);

						sources.set(key, s);
					}
				}
			}

			for ([, s] of this.#sources) {
				get(s);
			}
		}

		keys() {
			get(this.#version);
			return super.keys();
		}

		values() {
			this.#read_all();
			return super.values();
		}

		entries() {
			this.#read_all();
			return super.entries();
		}

		[Symbol.iterator]() {
			return this.entries();
		}

		get size() {
			get(this.#size);
			return super.size;
		}
	}

	function addListener(event, callback) {
	  const listener = new Listener(event, callback);
	  listener.bindListener();
	  return () => listener.unbindListener();
	}
	function addListeners(bindings) {
	  const unbinds = Object.entries(bindings).map(
	    ([event, cb]) => addListener(event, cb)
	  );
	  return () => unbinds.forEach((unbind) => unbind());
	}
	function sendCommand(type, command, data) {
	  socket.sendCommand(
	    data === void 0 ? { type, command } : { type, command, data }
	  );
	}

	/* rooms.svelte.ts generated by Svelte v5.57.0 */

	function toRoom(info) {
		const { settings } = info;

		return {
			id: info.id,
			name: settings.roomName,
			host: info.host,
			hostAvatar: info.hostAvatar,
			isPrivate: Boolean(settings.privateRoom),
			inLobby: info.inLobby,
			mode: modeOf(settings),
			playerCount: info.numberOfPlayers,
			roomSize: settings.roomSize,
			spectatorCount: info.numberOfSpectators,
			players: info.allPlayers?.players ?? [],
			spectators: info.allPlayers?.spectators ?? [],
			friendNames: info.friendNames ?? [],
			songCount: settings.numberOfSongs,
			songsLeft: info.songLeft,
			guessTime: guessTimeOf(settings),
			songSelection: songSelectionOf(settings),
			songTypes: songTypesOf(settings),
			settings
		};
	}

	function applySettings(room, settings) {
		return {
			...room,
			settings,
			name: settings.roomName,
			isPrivate: Boolean(settings.privateRoom),
			roomSize: settings.roomSize,
			songCount: settings.numberOfSongs,
			mode: modeOf(settings),
			guessTime: guessTimeOf(settings),
			songSelection: songSelectionOf(settings),
			songTypes: songTypesOf(settings)
		};
	}

	function toggleRosterEntry(roster, name, level) {
		const index = roster.findIndex((entry) => entry.name === name);

		if (index !== -1) {
			return roster.filter((_, position) => position !== index);
		}

		return [...roster, { name, level }];
	}

	function toggleFriend(friends, name, joined) {
		if (joined) {
			return friends.includes(name) ? friends : [...friends, name];
		}

		return friends.filter((friend) => friend !== name);
	}

	class RoomStore {
		#rooms = new SvelteMap();
		#unbind = null;

		/** The room whose settings the host modal is previewing. */
		#previewRoomId = null;

		#bound = state(false);

		get bound() {
			return get(this.#bound);
		}

		set bound(value) {
			set(this.#bound, value, true);
		}

		#loaded = state(false);

		get loaded() {
			return get(this.#loaded);
		}

		set loaded(value) {
			set(this.#loaded, value, true);
		}

		#_rooms = user_derived(() => [...this.#rooms.values()]);

		get rooms() {
			return get(this.#_rooms);
		}

		set rooms(value) {
			set(this.#_rooms, value);
		}

		#roomCount = user_derived(() => this.#rooms.size);

		get roomCount() {
			return get(this.#roomCount);
		}

		set roomCount(value) {
			set(this.#roomCount, value);
		}

		#playerCount = user_derived(() => this.rooms.reduce((total, room) => total + room.playerCount, 0));

		get playerCount() {
			return get(this.#playerCount);
		}

		set playerCount(value) {
			set(this.#playerCount, value);
		}

		get(id) {
			return this.#rooms.get(id);
		}

		bind() {
			if (this.#unbind) return;

			this.#unbind = addListeners({
				"New Rooms": (data) => this.#onNewRooms(data),
				"Room Change": (data) => this.#onRoomChange(data)
			});

			this.bound = true;
			this.refresh();
		}

		unbind() {
			this.#unbind?.();
			this.#unbind = null;
			this.bound = false;
			this.loaded = false;
			this.#rooms.clear();
		}

		/** The reply arrives as `New Rooms`. */
		refresh() {
			sendCommand("roombrowser", "get rooms");
		}

		#onNewRooms(data) {
			for (const info of data.standard ?? []) {
				this.#rooms.set(info.id, toRoom(info));
			}

			this.loaded = true;
		}

		#onRoomChange(payload) {
			const room = this.#rooms.get(payload.roomId);

			if (!room) return;

			switch (payload.changeType) {
				case "settings":
					{
						if (!payload.change) break;

						this.#rooms.set(room.id, applySettings(room, { ...room.settings, ...payload.change }));

						if (this.#previewRoomId === room.id) {
							hostModal.changeSettings(payload.change);
						}

						break;
					}

				case "players":
					{
						const next = { ...room };

						if (payload.friend) {
							next.friendNames = toggleFriend(room.friendNames, payload.friend, (payload.playerCount ?? 0) > room.playerCount);
						}

						next.playerCount = payload.playerCount ?? room.playerCount;

						if (payload.playerName) {
							next.players = toggleRosterEntry(room.players, payload.playerName, payload.playerLevel ?? 0);
						}

						if (payload.newHost) next.host = payload.newHost.name;

						this.#rooms.set(room.id, next);

						break;
					}

				case "spectators":
					{
						const next = { ...room };

						if (payload.friend) {
							next.friendNames = toggleFriend(room.friendNames, payload.friend, (payload.spectatorCount ?? 0) > room.spectatorCount);
						}

						next.spectatorCount = payload.spectatorCount ?? room.spectatorCount;

						if (payload.playerName) {
							next.spectators = toggleRosterEntry(room.spectators, payload.playerName, payload.playerLevel ?? 0);
						}

						this.#rooms.set(room.id, next);

						break;
					}

				case "songsLeft":
					{
						this.#rooms.set(room.id, { ...room, songsLeft: payload.songsLeft ?? room.songsLeft });

						break;
					}

				case "game start":
					{
						this.#rooms.set(room.id, { ...room, inLobby: false, songsLeft: room.songCount });

						break;
					}

				case "game over":
					{
						this.#rooms.set(room.id, { ...room, inLobby: true });

						break;
					}

				default:
					// roomTile.js:325. Any other changeType means the room closed.
					{
						if (this.#previewRoomId === room.id) {
							this.#previewRoomId = null;
							hostModal.hide();
						}

						this.#rooms.delete(room.id);

						break;
					}
			}
		}

		// --- actions ------------------------------------------------------------
		// These call AMQ's roomBrowser, which runs `lobby.setupLobby` and
		// `viewChanger.changeView('lobby')`.
		/** roomTile.js `joinGame`. A private room asks for the password first. */
		join(room) {
			if (!room.isPrivate) {
				roomBrowser.fireJoinLobby(room.id);

				return;
			}

			Swal.fire({
				title: t("room_browser.room_tile.password.title", "Password"),
				input: "password",
				inputPlaceholder: t("room_browser.room_tile.password.placeholder", "Password"),
				showCancelButton: true,
				confirmButtonText: t("room_browser.room_tile.password.confirm_button", "Join"),
				inputAttributes: { maxlength: 50, minlength: 1 }
			}).then((result) => {
				if (result.isConfirmed) roomBrowser.fireJoinLobby(room.id, result.value);
			});
		}

		/** roomTile.js `spectateGame`. AMQ shows the private-room prompt itself. */
		spectate(room) {
			if (room.isPrivate) {
				roomBrowser.spectateGameWithPassword(room.id);
			} else {
				roomBrowser.fireSpectateGame(room.id);
			}
		}

		host() {
			roomBrowser.openHostModal();
		}

		/**
		 * Opens AMQ's host modal read-only on a room's settings, as
		 * `.rbrAllOptionsIcon` does (roomTile.js `previewSettings`).
		 *
		 * Keep this call order. `changeSettings` sets `hostModal.gameMode`, and
		 * `setModePreviewGame` reads it for the title.
		 */
		previewSettings(room) {
			this.#previewRoomId = room.id;

			const live = () => this.#rooms.get(room.id) ?? room;

			hostModal.changeSettings(live().settings);

			hostModal.setModePreviewGame({
				joinGame: () => this.join(live()),
				spectateGame: () => this.spectate(live()),
				settingPreviewClosed: () => {
					this.#previewRoomId = null;
				}
			});

			hostModal.showSettings();
			hostModal.show();
		}
	}

	const roomStore = new RoomStore();

	const SERVER_ONLY_QUIZ_FIELDS = ["version"];
	const SERVER_ONLY_BLOCK_FIELDS = ["matchSongCount"];
	const SERVER_ONLY_ENTRY_FIELDS = ["annSongIds"];
	function isAnimeEntry(save) {
	  return save.annId !== void 0;
	}
	function isSongEntry(save) {
	  return save.annSongId !== void 0;
	}
	function isAlgorithmEntry(save) {
	  return save.settings !== void 0;
	}
	function isMessageEntry(save) {
	  return save.message !== void 0;
	}
	function isTitleEntry(save) {
	  return save.title !== void 0;
	}

	let counter = 0;
	function nextId(prefix) {
	  counter += 1;
	  return `${prefix}-${counter}`;
	}

	function rest(source, known) {
	  const extra = {};
	  let found = false;
	  for (const key of Object.keys(source)) {
	    if (!known.includes(key)) {
	      extra[key] = source[key];
	      found = true;
	    }
	  }
	  return found ? extra : void 0;
	}
	function withUnknown(value, unknown) {
	  return unknown ? { ...value, ...unknown } : value;
	}
	const OVERRIDE_KEYS = [
	  "guessTime",
	  "samplePoint",
	  "playBackSpeed",
	  "guessModes"
	];
	const ENTRY_BASE_KEYS = ["connectUp", "locked"];
	const PLAY_ENTRY_KEYS = [...ENTRY_BASE_KEYS, ...OVERRIDE_KEYS];
	function readOverrides(save) {
	  const overrides = {};
	  for (const key of OVERRIDE_KEYS) {
	    if (save[key] !== void 0) {
	      overrides[key] = save[key];
	    }
	  }
	  return overrides;
	}
	function writeOverrides(overrides) {
	  const out = {};
	  for (const key of OVERRIDE_KEYS) {
	    const value = overrides[key];
	    if (value !== void 0) out[key] = value;
	  }
	  return out;
	}
	function entryFromSave(save) {
	  const raw = save;
	  const base = {
	    connectUp: Boolean(save.connectUp),
	    locked: Boolean(save.locked)
	  };
	  if (isAnimeEntry(save)) {
	    return {
	      ...base,
	      id: nextId("anime"),
	      kind: "anime",
	      annId: save.annId,
	      includeSongTypes: save.includeSongTypes,
	      numberOfSongs: save.numberOfSongs,
	      overrides: readOverrides(raw),
	      unknown: rest(raw, [
	        ...PLAY_ENTRY_KEYS,
	        "annId",
	        "includeSongTypes",
	        "numberOfSongs"
	      ])
	    };
	  }
	  if (isSongEntry(save)) {
	    return {
	      ...base,
	      id: nextId("song"),
	      kind: "song",
	      annSongId: save.annSongId,
	      overrides: readOverrides(raw),
	      unknown: rest(raw, [...PLAY_ENTRY_KEYS, "annSongId"])
	    };
	  }
	  if (isAlgorithmEntry(save)) {
	    return {
	      ...base,
	      id: nextId("algorithm"),
	      kind: "algorithm",
	      settings: save.settings,
	      overrides: readOverrides(raw),
	      // The server sends matches on load and the client deletes them from the
	      // payload. Listing `annSongIds` as known keeps it out of the save.
	      matchedAnnSongIds: raw.annSongIds,
	      unknown: rest(raw, [...PLAY_ENTRY_KEYS, "settings", "annSongIds"])
	    };
	  }
	  if (isMessageEntry(save)) {
	    return {
	      ...base,
	      id: nextId("message"),
	      kind: "message",
	      message: save.message,
	      avatar: save.avatar,
	      videoDisplay: Boolean(save.videoDisplay),
	      delay: save.delay,
	      time: save.time,
	      unknown: rest(raw, [
	        ...ENTRY_BASE_KEYS,
	        "message",
	        "avatar",
	        "videoDisplay",
	        "delay",
	        "time"
	      ])
	    };
	  }
	  if (isTitleEntry(save)) {
	    return {
	      ...base,
	      id: nextId("title"),
	      kind: "title",
	      title: save.title,
	      unknown: rest(raw, [...ENTRY_BASE_KEYS, "title"])
	    };
	  }
	  throw new Error(
	    `[amq-ui] unrecognised quiz block: ${JSON.stringify(Object.keys(raw))}`
	  );
	}
	const RULE_BLOCK_KEYS = [
	  "randomOrder",
	  "songCount",
	  "guessTime",
	  "samplePoint",
	  "playBackSpeed",
	  "duplicates",
	  "guessModes",
	  "blocks",
	  // Listed so they reach neither the model nor the unknown bag, and are not
	  // sent back on save.
	  ...SERVER_ONLY_BLOCK_FIELDS
	];
	function ruleBlockFromSave(save) {
	  const raw = save;
	  return {
	    id: nextId("block"),
	    randomOrder: Boolean(save.randomOrder),
	    songCount: save.songCount,
	    guessTime: save.guessTime,
	    samplePoint: save.samplePoint,
	    playBackSpeed: save.playBackSpeed,
	    duplicates: Boolean(save.duplicates),
	    guessModes: save.guessModes,
	    entries: (save.blocks ?? []).map(entryFromSave),
	    unknown: rest(raw, RULE_BLOCK_KEYS)
	  };
	}
	const QUIZ_KEYS = [
	  "name",
	  "description",
	  "tags",
	  "ruleBlocks",
	  "ruleBlockRandomOrder",
	  ...SERVER_ONLY_QUIZ_FIELDS
	];
	function fromSave(save) {
	  const raw = save;
	  return {
	    name: save.name,
	    description: save.description,
	    tags: save.tags ?? [],
	    ruleBlockRandomOrder: Boolean(save.ruleBlockRandomOrder),
	    blocks: (save.ruleBlocks ?? []).map(ruleBlockFromSave),
	    unknown: rest(raw, QUIZ_KEYS)
	  };
	}
	function entryToSave(entry, index) {
	  const base = { connectUp: index > 0 && entry.connectUp, locked: entry.locked };
	  switch (entry.kind) {
	    case "anime":
	      return withUnknown(
	        {
	          ...base,
	          annId: entry.annId,
	          includeSongTypes: entry.includeSongTypes,
	          numberOfSongs: entry.numberOfSongs,
	          ...writeOverrides(entry.overrides)
	        },
	        entry.unknown
	      );
	    case "song":
	      return withUnknown(
	        {
	          ...base,
	          annSongId: entry.annSongId,
	          ...writeOverrides(entry.overrides)
	        },
	        entry.unknown
	      );
	    case "algorithm":
	      return withUnknown(
	        {
	          ...base,
	          settings: entry.settings,
	          ...writeOverrides(entry.overrides)
	        },
	        entry.unknown
	      );
	    // The client spreads the base last for message and title
	    // (`customQuizMessageBlock.js:129`). Key order does not affect equality,
	    // but the same order keeps a diff of the two payloads readable.
	    case "message":
	      return withUnknown(
	        {
	          message: entry.message,
	          avatar: entry.avatar,
	          videoDisplay: entry.videoDisplay,
	          delay: entry.delay,
	          time: entry.time,
	          ...base
	        },
	        entry.unknown
	      );
	    case "title":
	      return withUnknown(
	        { title: entry.title, ...base },
	        entry.unknown
	      );
	  }
	}
	function ruleBlockToSave(block) {
	  return withUnknown(
	    {
	      randomOrder: block.randomOrder,
	      songCount: block.songCount,
	      guessTime: block.guessTime,
	      samplePoint: block.samplePoint,
	      playBackSpeed: block.playBackSpeed,
	      blocks: block.entries.map(entryToSave),
	      duplicates: block.duplicates,
	      guessModes: block.guessModes
	    },
	    block.unknown
	  );
	}
	function toSave(quiz) {
	  return withUnknown(
	    {
	      name: quiz.name,
	      description: quiz.description,
	      tags: quiz.tags,
	      ruleBlocks: quiz.blocks.map(ruleBlockToSave),
	      ruleBlockRandomOrder: quiz.ruleBlockRandomOrder
	    },
	    quiz.unknown
	  );
	}

	function blockInfo(block, library) {
	  let songCount = 0;
	  const animeSeen = /* @__PURE__ */ new Set();
	  const songsSeen = /* @__PURE__ */ new Set();
	  const { duplicates } = block;
	  for (const entry of block.entries) {
	    if (entry.kind === "algorithm") {
	      const numberOfSongs = Number(entry.settings.numberOfSongs ?? 0);
	      const matched = entry.matchedAnnSongIds ?? [];
	      if (duplicates) {
	        songCount += matched.length > 0 && matched.length < numberOfSongs ? matched.length : numberOfSongs;
	      }
	      for (const annSongId of matched) {
	        songsSeen.add(annSongId);
	        const annId = library.annIdFromAnnSongId(annSongId);
	        if (annId !== void 0 && !animeSeen.has(annId)) {
	          animeSeen.add(annId);
	          if (!duplicates) songCount += 1;
	        }
	      }
	      continue;
	    }
	    if (entry.kind === "anime") {
	      const available = library.animeSongIds(
	        entry.annId,
	        entry.includeSongTypes
	      );
	      if (duplicates) {
	        songCount += available.length < entry.numberOfSongs ? available.length : entry.numberOfSongs;
	      } else if (!animeSeen.has(entry.annId) && available.length > 0) {
	        songCount += 1;
	      }
	      if (available.length > 0) animeSeen.add(entry.annId);
	      for (const annSongId of available) songsSeen.add(annSongId);
	      continue;
	    }
	    if (entry.kind === "song") {
	      songsSeen.add(entry.annSongId);
	      const annId = library.annIdFromAnnSongId(entry.annSongId);
	      if (duplicates) {
	        songCount += 1;
	      } else if (annId !== void 0 && !animeSeen.has(annId)) {
	        songCount += 1;
	      }
	      if (annId !== void 0) animeSeen.add(annId);
	    }
	  }
	  return {
	    songCount,
	    uniqueAnime: animeSeen.size,
	    uniqueSongs: songsSeen.size
	  };
	}
	function blockChosen(block, library) {
	  return Math.min(block.songCount, blockInfo(block, library).songCount);
	}
	function quizTotals(quiz, library) {
	  const animeSeen = /* @__PURE__ */ new Set();
	  const songsSeen = /* @__PURE__ */ new Set();
	  let chosen = 0;
	  for (const block of quiz.blocks) {
	    chosen += blockChosen(block, library);
	    for (const entry of block.entries) {
	      collectIds(entry, library, animeSeen, songsSeen);
	    }
	  }
	  return {
	    chosen,
	    uniqueSongs: songsSeen.size,
	    uniqueAnime: animeSeen.size,
	    blocks: quiz.blocks.length
	  };
	}
	function collectIds(entry, library, animeSeen, songsSeen) {
	  if (entry.kind === "anime") {
	    const available = library.animeSongIds(entry.annId, entry.includeSongTypes);
	    if (available.length > 0) animeSeen.add(entry.annId);
	    for (const id of available) songsSeen.add(id);
	    return;
	  }
	  if (entry.kind === "song") {
	    songsSeen.add(entry.annSongId);
	    const annId = library.annIdFromAnnSongId(entry.annSongId);
	    if (annId !== void 0) animeSeen.add(annId);
	    return;
	  }
	  if (entry.kind === "algorithm") {
	    for (const id of entry.matchedAnnSongIds ?? []) {
	      songsSeen.add(id);
	      const annId = library.annIdFromAnnSongId(id);
	      if (annId !== void 0) animeSeen.add(annId);
	    }
	  }
	}

	function needle(raw) {
	  return raw.trim().toLowerCase() || null;
	}
	function animeSearchNames(anime) {
	  const precomputed = anime.searchNames;
	  if (Array.isArray(precomputed) && precomputed.length > 0) return precomputed;
	  return [
	    anime.mainName ?? "",
	    ...(anime.names ?? []).map((entry) => entry?.name ?? "")
	  ].filter(Boolean).map((name) => String(name).toLowerCase());
	}
	function creditSearchNames(entry) {
	  if (!entry) return [];
	  let entries = [entry];
	  if (typeof entry.getFullMemberEntryList === "function") {
	    try {
	      entries = entry.getFullMemberEntryList() ?? [entry];
	    } catch {
	      entries = [entry];
	    }
	  }
	  const names = [];
	  for (const member of entries) {
	    const precomputed = member?.searchNames;
	    if (Array.isArray(precomputed)) names.push(...precomputed);
	    else if (member?.name) names.push(String(member.name).toLowerCase());
	  }
	  return names;
	}
	const songNameCache = /* @__PURE__ */ new WeakMap();
	function songSearchNames(songEntry) {
	  const cached = songNameCache.get(songEntry);
	  if (cached) return cached;
	  const names = /* @__PURE__ */ new Set();
	  const title = songEntry.searchNames;
	  if (Array.isArray(title) && title.length > 0) {
	    for (const name of title) names.add(name);
	  } else if (songEntry.name) {
	    names.add(String(songEntry.name).toLowerCase());
	  }
	  for (const credit of [
	    songEntry.artist,
	    songEntry.composer,
	    songEntry.arranger
	  ]) {
	    for (const name of creditSearchNames(credit)) names.add(name);
	  }
	  const flat = [...names];
	  songNameCache.set(songEntry, flat);
	  return flat;
	}
	function matchesSearchNames(names, query) {
	  return names.some((name) => name.includes(query));
	}
	function songMatchesSearch(song, query) {
	  const entry = song.songEntry;
	  if (!entry) return false;
	  return songSearchNames(entry).some((name) => name.includes(query));
	}

	/* quizFilters.svelte.ts generated by Svelte v5.57.0 */

	const STORAGE_KEY$1 = "amq-quiz-library-filters";

	const STORAGE_VERSION$1 = 2;

	const LIKE_NONE = 0;
	const LIKE_LIKED = 1;
	const LIKE_DISLIKED = 2;
	const CATEGORY_INSTRUMENTAL = 1;
	const CATEGORY_CHANTING = 2;
	const CATEGORY_CHARACTER = 3;
	const CATEGORY_STANDARD = 4;
	const YEAR_MIN = 1924;
	const YEAR_MAX = 2026;

	function option$1(key, i18n, fallback) {
		return { key, label: () => t(i18n, fallback) };
	}

	function group$1(key, label, options, on = true) {
		const defaults = {};

		for (const entry of options) {
			defaults[entry.key] = on === true || on.includes(entry.key);
		}

		return { key, label, options, defaults };
	}

	const TOGGLE_GROUPS$1 = [
		// Defaults to watched only. The full library has about ten times as many
		// anime as a typical watch list, which hides the ones the player knows.
		group$1(
			"watchStatus",
			() => t("song_library.filters.watch_status", "Watch status"),
			[
				option$1("watched", "song_library.filters.watched", "Watched"),
				option$1("unwatched", "song_library.filters.unwatched", "Unwatched")
			],
			["watched"]
		),

		group$1("songTypes", () => t("room_browser.filters.song_type.title", "Song types"), [
			option$1("op", "quiz_builder.algorithm_block.song_type.opening", "OP"),
			option$1("ed", "quiz_builder.algorithm_block.song_type.ending", "ED"),
			option$1("in", "quiz_builder.algorithm_block.song_type.insert", "IN")
		]),

		group$1("playerState", () => t("song_library.filters.player_state", "Player state"), [
			option$1("liked", "song_library.filters.liked", "Liked"),
			option$1("unrated", "song_library.filters.unrated", "Unrated"),
			option$1("disliked", "song_library.filters.disliked", "Disliked")
		]),

		group$1("categories", () => t("song_catagory.title", "Song categories"), [
			option$1("standard", "song_catagory.standard", "Standard"),
			option$1("instrumental", "song_catagory.instrumental", "Instrumental"),
			option$1("chanting", "song_catagory.chanting", "Chanting"),
			option$1("character", "song_catagory.character", "Character")
		]),

		/*
		 * All ten types from `anime_types_base`, not the five SPEC lists. A type
		 * with no option could never be filtered out. Keys match what
		 * `convertCategoryToKey` derives from `category.name`. Labels come from
		 * `anime_types_base` because those strings have no `_NUMBER_` placeholder.
		 */
		group$1("animeType", () => t("room_browser.filters.anime_type.title", "Anime type"), [
			option$1("tv", "anime_types_base.tv", "TV"),
			option$1("season", "anime_types_base.season", "Season"),
			option$1("movie", "anime_types_base.movie", "Movie"),
			option$1("ova", "anime_types_base.ova", "OVA"),
			option$1("ona", "anime_types_base.ona", "ONA"),
			option$1("tv_special", "anime_types_base.tv_special", "TV Special"),
			option$1("special", "anime_types_base.special", "Special"),
			option$1("music_video", "anime_types_base.music_video", "Music Video"),
			option$1("doujin", "anime_types_base.doujin", "Doujin"),
			option$1("game_cutscene_compilation", "anime_types_base.game_cutscene_compilation", "Game Cutscene")
		])
	];

	new Map(TOGGLE_GROUPS$1.map((entry) => [entry.key, entry]));

	function defaultState$1() {
		const toggles = {};

		for (const entry of TOGGLE_GROUPS$1) toggles[entry.key] = { ...entry.defaults };

		return {
			tab: "library",
			search: "",
			toggles,
			vintage: [YEAR_MIN, YEAR_MAX]
		};
	}

	function clamp$1(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function load$1() {
		const state = defaultState$1();
		let stored;

		try {
			const raw = localStorage.getItem(STORAGE_KEY$1);

			if (!raw) return state;

			stored = JSON.parse(raw);
		} catch {
			return state;
		}

		if (!stored || stored.version !== STORAGE_VERSION$1) return state;

		for (const entry of TOGGLE_GROUPS$1) {
			const group2 = stored.toggles?.[entry.key];

			if (!group2) continue;

			for (const item of entry.options) {
				if (typeof group2[item.key] === "boolean") {
					state.toggles[entry.key][item.key] = group2[item.key];
				}
			}
		}

		const pair = stored.vintage;

		if (Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite)) {
			state.vintage = [
				clamp$1(pair[0], YEAR_MIN, YEAR_MAX),
				clamp$1(pair[1], YEAR_MIN, YEAR_MAX)
			];
		}

		return state;
	}

	const SAVE_DELAY_MS$1 = 300;
	const SEARCH_DEBOUNCE_MS = 120;

	class LibraryFilterStore {
		#state = state(proxy(load$1()));

		get state() {
			return get(this.#state);
		}

		set state(value) {
			set(this.#state, value, true);
		}

		#draft = state("");

		get draft() {
			return get(this.#draft);
		}

		set draft(value) {
			set(this.#draft, value, true);
		}

		#saveTimer = null;
		#searchTimer = null;
		#defaults = defaultState$1();

		get search() {
			return this.state.search;
		}

		toggles(group2) {
			return this.state.toggles[group2];
		}

		groupChanged(key) {
			const current = this.state.toggles[key];
			const base = this.#defaults.toggles[key];

			return Object.keys(base).some((option2) => current[option2] !== base[option2]);
		}

		#vintageChanged = user_derived(() => this.state.vintage[0] !== YEAR_MIN || this.state.vintage[1] !== YEAR_MAX);

		get vintageChanged() {
			return get(this.#vintageChanged);
		}

		set vintageChanged(value) {
			set(this.#vintageChanged, value);
		}

		#changedCount = user_derived(() => TOGGLE_GROUPS$1.filter((entry) => this.groupChanged(entry.key)).length + (this.vintageChanged ? 1 : 0));

		get changedCount() {
			return get(this.#changedCount);
		}

		set changedCount(value) {
			set(this.#changedCount, value);
		}

		setSearch(value) {
			this.draft = value;

			if (this.#searchTimer) clearTimeout(this.#searchTimer);

			if (value === "") {
				this.state.search = "";

				return;
			}

			this.#searchTimer = setTimeout(
				() => {
					this.#searchTimer = null;
					this.state.search = value;
				},
				SEARCH_DEBOUNCE_MS
			);
		}

		setTab(tab) {
			this.state.tab = tab;
		}

		toggle(group2, option2) {
			const current = this.state.toggles[group2];

			current[option2] = !current[option2];
			this.#save();
		}

		setVintage(index, raw) {
			if (!Number.isFinite(raw)) return;

			const value = clamp$1(Math.round(raw), YEAR_MIN, YEAR_MAX);
			const pair = [...this.state.vintage];

			pair[index] = value;

			if (index === 0 && value > pair[1]) pair[1] = value;
			if (index === 1 && value < pair[0]) pair[0] = value;

			this.state.vintage = pair;
			this.#save();
		}

		resetGroup(key) {
			this.state.toggles[key] = { ...this.#defaults.toggles[key] };
			this.#save();
		}

		resetVintage() {
			this.state.vintage = [...this.#defaults.vintage];
			this.#save();
		}

		resetAll() {
			const base = defaultState$1();

			this.state.toggles = base.toggles;
			this.state.vintage = base.vintage;
			this.#save();
		}

		#save() {
			if (this.#saveTimer) clearTimeout(this.#saveTimer);

			this.#saveTimer = setTimeout(
				() => {
					this.#saveTimer = null;

					const snapshot$1 = snapshot(this.state);

					try {
						localStorage.setItem(STORAGE_KEY$1, JSON.stringify({
							version: STORAGE_VERSION$1,
							toggles: snapshot$1.toggles,
							vintage: snapshot$1.vintage
						}));
					} catch {}
				},
				SAVE_DELAY_MS$1
			);
		}

		// --- predicates ----------------------------------------------------------
		/**
		 * Predicates over a **plain** snapshot of the filter state.
		 *
		 * `this.state` is a deep `$state` proxy, and reading it inside the filter
		 * loop costs a proxy trap per property access, tens of thousands of times
		 * per pass. One snapshot up front avoids that and still registers the
		 * dependency, so the derivation re-runs when a filter changes.
		 */
		get predicates() {
			const toggles = snapshot(this.state.toggles);
			const vintage = snapshot(this.state.vintage);

			return {
				matchesAnime: (anime) => animeMatches(anime, toggles, vintage),
				matchesSong: (song) => songMatches(song, toggles)
			};
		}

		/** Tests that do not depend on a specific song. */
		matchesAnime(anime) {
			return animeMatches(anime, snapshot(this.state.toggles), snapshot(this.state.vintage));
		}

		matchesSong(song) {
			return songMatches(song, snapshot(this.state.toggles));
		}
	}

	function animeMatches(anime, toggles, vintage) {
		const watch = toggles.watchStatus;
		const watched = anime.watched === true;

		if (!watch.watched && watched) return false;
		if (!watch.unwatched && !watched) return false;

		const key = animeTypeKey(anime.category);

		if (key && key in toggles.animeType && !toggles.animeType[key]) return false;

		const year = anime.year ?? 0;

		if (year && (year < vintage[0] || year > vintage[1])) return false;

		return true;
	}

	function songMatches(song, toggles) {
		if (!song.uploaded) return false;

		const types = toggles.songTypes;

		if (song.type === 1 && !types.op) return false;
		if (song.type === 2 && !types.ed) return false;
		if (song.type === 3 && !types.in) return false;

		const state = toggles.playerState;
		const like = song.playerLikeStatus ?? LIKE_NONE;

		if (like === LIKE_LIKED && !state.liked) return false;
		if (like === LIKE_DISLIKED && !state.disliked) return false;
		if (like === LIKE_NONE && !state.unrated) return false;

		const categories = toggles.categories;
		const category = song.songEntry?.category;

		if (category === CATEGORY_STANDARD && !categories.standard) return false;
		if (category === CATEGORY_INSTRUMENTAL && !categories.instrumental) return false;
		if (category === CATEGORY_CHANTING && !categories.chanting) return false;
		if (category === CATEGORY_CHARACTER && !categories.character) return false;

		return true;
	}

	const libraryFilters = new LibraryFilterStore();

	/* library.svelte.ts generated by Svelte v5.57.0 */

	let cacheRevision = state(0);

	function trackCache() {
		return get(cacheRevision);
	}

	let unreadableAnime = 0;

	function unreadableAnimeCount() {
		return unreadableAnime;
	}

	let passFailed = false;

	function libraryPassFailed() {
		return passFailed;
	}

	function guardPass(label, run, fallback) {
		try {
			const value = run();

			passFailed = false;

			return value;
		} catch(error) {
			console.error(`[amq-ui] the song library could not be read (${label})`, error);
			passFailed = true;

			return fallback;
		}
	}

	const LOAD_TIMEOUT_MS = 45e3;
	let loadPromise = null;

	function bumpCache() {
		set(cacheRevision, get(cacheRevision) + 1);
	}

	function loadLibraryCache() {
		if (loadPromise) return loadPromise;

		loadPromise = new Promise((resolve) => {
			let settled = false;

			const finish = (ok) => {
				if (settled) return;

				settled = true;
				set(cacheRevision, get(cacheRevision) + 1);
				resolve(ok);
			};

			const timer = setTimeout(
				() => {
					loadPromise = null;
					finish(false);
				},
				LOAD_TIMEOUT_MS
			);

			try {
				libraryCacheHandler.getCache(() => {
					clearTimeout(timer);
					finish(true);
				});
			} catch(error) {
				clearTimeout(timer);
				console.error("[amq-ui] could not load the song library", error);
				loadPromise = null;
				finish(false);
			}
		});

		return loadPromise;
	}

	const SONG_TYPE_OPENING = 1;
	const SONG_TYPE_ENDING = 2;

	function songTypeBadge(type, number) {
		if (type === SONG_TYPE_OPENING) {
			return t("quiz_builder.song_block.song_types.opening", `OP${number}`, { number });
		}

		if (type === SONG_TYPE_ENDING) {
			return t("quiz_builder.song_block.song_types.ending", `ED${number}`, { number });
		}

		return t("quiz_builder.song_block.song_types.insert", "IN");
	}

	function animeTypeKey(category) {
		return (category?.name ?? "").toLowerCase().replace(/ /g, "_");
	}

	function animeTypeLabel(category) {
		if (!category?.name) return "";

		const number = category.number;

		try {
			const { key, parameters } = localizationHandler.convertCategoryToKey(category);
			const label = localizationHandler.translate(key, parameters);

			if (label && label !== key) return label.trim();
		} catch {}

		return number ? `${category.name} ${number}` : category.name;
	}

	function unknownAnime(annId) {
		return {
			annId,
			name: t("quiz_builder.unknown_anime", `Anime #${annId}`),
			category: "",
			year: 0,
			seasonId: 0,
			watched: false,
			opCount: 0,
			edCount: 0,
			insCount: 0,
			known: false
		};
	}

	function describeAnime(annId) {
		trackCache();

		let anime;

		try {
			anime = libraryCacheHandler?.getCachedAnime(annId);
		} catch {
			anime = void 0;
		}

		if (!anime) return unknownAnime(annId);

		return {
			annId,
			// `mainName` follows the player's romaji setting, as on AMQ's screens.
			name: anime.mainName ?? unknownAnime(annId).name,
			category: animeTypeLabel(anime.category),
			year: anime.year ?? 0,
			seasonId: anime.seasonId ?? 0,
			watched: anime.watched === true,
			opCount: anime.songs?.OP?.length ?? 0,
			edCount: anime.songs?.ED?.length ?? 0,
			insCount: anime.songs?.INS?.length ?? 0,
			known: true
		};
	}

	function describeSong(annSongId) {
		trackCache();

		let entry;

		try {
			entry = libraryCacheHandler?.getCachedAnnSongEntry(annSongId);
		} catch {
			entry = void 0;
		}

		if (!entry) {
			return {
				annSongId,
				animeName: "",
				title: t("quiz_builder.unknown_song", `Song #${annSongId}`),
				artist: "",
				badge: "",
				known: false
			};
		}

		const song = entry.songEntry;

		return {
			annSongId,
			animeName: describeAnime(entry.annId).name,
			title: song?.name ?? "",
			// The cache sets `artist` from the artist map or the group map
			// (`libraryCacheHandler.js:541`).
			artist: song?.artist?.name ?? "",
			badge: songTypeBadge(entry.type, entry.number),
			known: true
		};
	}

	const amqLibrary = {
		animeSongIds(annId, types) {
			trackCache();

			const anime = libraryCacheHandler?.getCachedAnime(annId);

			if (!anime) return [];

			const ids = [];

			if (types.op) ids.push(...(anime.songs?.OP ?? []).map((s) => s.annSongId));
			if (types.ed) ids.push(...(anime.songs?.ED ?? []).map((s) => s.annSongId));
			if (types.in) ids.push(...(anime.songs?.INS ?? []).map((s) => s.annSongId));

			return ids;
		},

		annIdFromAnnSongId(annSongId) {
			trackCache();

			try {
				return libraryCacheHandler?.getAnnIdFromAnnSongId(annSongId);
			} catch {
				return void 0;
			}
		}
	};

	const NEW_SONG_DISPLAY_AMOUNT = 200;
	const PAGE = 300;
	const SEASON_KEYS = ["winter", "spring", "summer", "fall"];

	function vintageLabel$1(year, seasonId) {
		const key = SEASON_KEYS[seasonId];

		if (!key) return year ? String(year) : "";

		const season = key[0].toUpperCase() + key.slice(1);

		if (!year) return season;

		return t(`song_library.anime_entry.vintage.${key}`, `${season} ${year}`, { year });
	}

	function allAnime() {
		trackCache();

		try {
			const cache = libraryCacheHandler?.animeCache;

			return cache ? Object.values(cache) : [];
		} catch {
			return [];
		}
	}

	function songRow(song, animeName) {
		const entry = song.songEntry;

		return {
			kind: "song",
			id: `s${song.annSongId}`,
			annSongId: song.annSongId,
			annId: song.annId,
			title: entry?.name ?? "",
			artist: entry?.artist?.name ?? "",
			badge: songTypeBadge(song.type, song.number),
			animeName
		};
	}

	class LibraryStore {
		/** Anime whose songs are listed below their row. */
		expanded = new SvelteSet();

		#loaded = /** True once AMQ's cache is populated. */
		state(false);

		get loaded() {
			return get(this.#loaded);
		}

		set loaded(value) {
			set(this.#loaded, value, true);
		}

		#loading = state(false);

		get loading() {
			return get(this.#loading);
		}

		set loading(value) {
			set(this.#loading, value, true);
		}

		#failed = state(false);

		get failed() {
			return get(this.#failed);
		}

		set failed(value) {
			set(this.#failed, value, true);
		}

		async load() {
			if (this.loaded) return true;

			this.loading = true;
			this.failed = false;

			const ok = await loadLibraryCache();

			this.loading = false;
			this.loaded = ok && allAnime().length > 0;
			this.failed = !this.loaded;

			return this.loaded;
		}

		toggle(annId) {
			if (this.expanded.has(annId)) this.expanded.delete(annId); else this.expanded.add(annId);
		}

		/**
		 * The whole library in display order, sorted once per cache load.
		 *
		 * The sort is the expensive step: `localeCompare` over the whole library
		 * takes a few hundred milliseconds. This `$derived` depends only on
		 * `trackCache()`, so a search re-runs only the cheap predicate over the
		 * sorted list.
		 */
		#sortedAnime = user_derived(() => {
			const prepared = [];
			let unreadable = 0;

			for (const anime of allAnime()) {
				try {
					prepared.push({
						anime,
						name: anime.mainName ?? "",
						// Resolved once here, not per keystroke.
						search: animeSearchNames(anime),

						songs: [
							...anime.songs?.OP ?? [],
							...anime.songs?.ED ?? [],
							...anime.songs?.INS ?? []
						]
					});
				} catch {
					unreadable += 1;
				}
			}

			prepared.sort((a, b) => a.name.localeCompare(b.name));
			unreadableAnime = unreadable;

			return prepared;
		});

		/**
		 * Anime that match the filters, each with the songs that match. An anime
		 * with no matching song is dropped.
		 */
		#matchingAnime = user_derived(() => guardPass("anime", () => this.#computeMatchingAnime(), { page: [], animeTotal: 0, songTotal: 0 }));

		#computeMatchingAnime() {
			const query = needle(libraryFilters.search);
			const { matchesAnime, matchesSong } = libraryFilters.predicates;
			const page = [];
			let animeTotal = 0;
			let songTotal = 0;

			for (const entry of get(this.#sortedAnime)) {
				if (!matchesAnime(entry.anime)) continue;

				const wholeAnime = !query || matchesSearchNames(entry.search, query);
				const keep = (song) => matchesSong(song) && (wholeAnime || query !== null && songMatchesSearch(song, query));
				let matching = 0;

				for (const song of entry.songs) {
					if (keep(song)) matching += 1;
				}

				if (matching === 0) continue;

				animeTotal += 1;
				songTotal += matching;

				if (page.length < PAGE) {
					page.push({ anime: entry.anime, songs: entry.songs.filter(keep) });
				}
			}

			return { page, animeTotal, songTotal };
		}

		/** Songs that match the filters, for the New and Wrong tabs. */
		#matchingSongs = user_derived(() => guardPass("songs", () => this.#computeMatchingSongs(), []));

		#computeMatchingSongs() {
			const query = needle(libraryFilters.search);
			const tab = libraryFilters.state.tab;
			const { matchesAnime, matchesSong } = libraryFilters.predicates;
			const out = [];

			for (const entry of get(this.#sortedAnime)) {
				const anime = entry.anime;

				if (!matchesAnime(anime)) continue;

				const animeHit = query ? matchesSearchNames(entry.search, query) : false;

				for (const song of entry.songs) {
					if (!matchesSong(song)) continue;
					if (tab === "wrong" && !song.wrongIndex) continue;
					if (query && !animeHit && !songMatchesSearch(song, query)) continue;

					out.push(song);
				}
			}

			if (tab === "new") {
				out.sort((a, b) => b.annSongId - a.annSongId);

				return out.slice(0, NEW_SONG_DISPLAY_AMOUNT);
			}

			out.sort((a, b) => (a.wrongIndex ?? 0) - (b.wrongIndex ?? 0));

			return out;
		}

		#animeTotal = user_derived(() => libraryFilters.state.tab === "library"
			? get(this.#matchingAnime).animeTotal
			: new Set(get(this.#matchingSongs).map((song) => song.annId)).size);

		get animeTotal() {
			return get(this.#animeTotal);
		}

		set animeTotal(value) {
			set(this.#animeTotal, value);
		}

		#songTotal = user_derived(() => libraryFilters.state.tab === "library"
			? get(this.#matchingAnime).songTotal
			: get(this.#matchingSongs).length);

		get songTotal() {
			return get(this.#songTotal);
		}

		set songTotal(value) {
			set(this.#songTotal, value);
		}

		#shown = user_derived(() => Math.min(
			libraryFilters.state.tab === "library"
				? get(this.#matchingAnime).animeTotal
				: get(this.#matchingSongs).length,
			PAGE
		));

		get shown() {
			return get(this.#shown);
		}

		set shown(value) {
			set(this.#shown, value);
		}

		#total = user_derived(() => libraryFilters.state.tab === "library"
			? get(this.#matchingAnime).animeTotal
			: get(this.#matchingSongs).length);

		get total() {
			return get(this.#total);
		}

		set total(value) {
			set(this.#total, value);
		}

		#capped = user_derived(() => this.total > PAGE);

		get capped() {
			return get(this.#capped);
		}

		set capped(value) {
			set(this.#capped, value);
		}

		#rows = user_derived(() => guardPass("rows", () => this.#computeRows(), []));

		get rows() {
			return get(this.#rows);
		}

		set rows(value) {
			set(this.#rows, value);
		}

		#computeRows() {
			if (libraryFilters.state.tab !== "library") {
				return get(this.#matchingSongs).slice(0, PAGE).map((song) => songRow(song, describeAnime(song.annId).name));
			}

			const rows = [];

			for (const { anime, songs } of get(this.#matchingAnime).page) {
				const parts = [
					animeTypeLabel(anime.category),
					vintageLabel$1(anime.year ?? 0, anime.seasonId ?? -1)
				];

				const counts = [
					`OP ${anime.songs?.OP?.length ?? 0}`,
					`ED ${anime.songs?.ED?.length ?? 0}`,
					`IN ${anime.songs?.INS?.length ?? 0}`
				];

				rows.push({
					kind: "anime",
					id: `a${anime.annId}`,
					annId: anime.annId,
					name: anime.mainName,
					sub: [...parts.filter(Boolean), ...counts].join(" · "),
					songCount: songs.length,
					songs
				});

				if (this.expanded.has(anime.annId)) {
					for (const song of songs) rows.push(songRow(song));
				}
			}

			return rows;
		}

		/**
		 * True when a whole pass failed, which means the payload changed shape.
		 *
		 * A getter, not a `$derived`: it reads a non-reactive flag, and a derived
		 * would cache `false`. The render that sets the flag also empties `rows`,
		 * so templates re-read it.
		 */
		get broken() {
			return libraryPassFailed();
		}
	}

	const libraryStore = new LibraryStore();

	function isPlayEntry(entry) {
	  return entry.kind === "anime" || entry.kind === "song" || entry.kind === "algorithm";
	}
	const MAX_RULE_BLOCKS = 30;
	const MAX_ALGORITHM_BLOCKS = 7;
	const MAX_SONG_COUNT = 250;
	const MAX_MESSAGE_BLOCKS = 500;
	const MAX_TITLE_BLOCKS = 100;
	const MAX_BLOCK_COUNT = 2e3;
	const MAX_TAGS = 2;
	const DEFAULT_SONG_COUNT = 20;
	const PLAYBACK_SPEED_TICKS = [1, 1.5, 2, 4];
	function defaultGuessModes() {
	  return { song: true, tinyVideo: false, blurVideo: false };
	}
	function defaultRuleBlock(id) {
	  return {
	    id,
	    randomOrder: true,
	    songCount: DEFAULT_SONG_COUNT,
	    guessTime: { guessTime: 20, extraGuessTime: 0 },
	    samplePoint: { samplePoint: 50 },
	    playBackSpeed: { playBackSpeed: 1 },
	    duplicates: true,
	    guessModes: defaultGuessModes(),
	    entries: []
	  };
	}
	function emptyQuiz(id) {
	  return {
	    name: "",
	    description: "",
	    tags: [],
	    ruleBlockRandomOrder: false,
	    blocks: [defaultRuleBlock(id)]
	  };
	}
	function clampPick(value, pool) {
	  return Math.max(1, Math.min(value, Math.max(pool, 1)));
	}
	function totalSongCount(quiz) {
	  return quiz.blocks.reduce((total, block) => total + block.songCount, 0);
	}
	function songCountCeiling(quiz, block) {
	  const others = totalSongCount(quiz) - block.songCount;
	  return Math.min(MAX_SONG_COUNT - others, MAX_SONG_COUNT);
	}
	function countEntries(quiz, kind) {
	  return quiz.blocks.reduce(
	    (total, block) => total + block.entries.filter((entry) => entry.kind === kind).length,
	    0
	  );
	}
	function totalEntryCount(quiz) {
	  return quiz.blocks.reduce((total, block) => total + block.entries.length, 0);
	}

	/* quiz.svelte.ts generated by Svelte v5.57.0 */

	const UNDO_DEPTH = 50;
	let nextAlgorithmId = 0;

	class QuizStore {
		#unbind = null;

		/**
		 * The quiz as the server last had it, which `revert()` restores. Set on
		 * load, on a new quiz, and after a successful save.
		 */
		#saved = null;

		/** Snapshots for undo, oldest first. */
		#history = [];

		// The default matters: the `$derived` fields below run at field
		// initialisation, before the constructor assigns this.
		#library = amqLibrary;

		#quiz = state(proxy(emptyQuiz(nextId("block"))));

		get quiz() {
			return get(this.#quiz);
		}

		set quiz(value) {
			set(this.#quiz, value, true);
		}

		#quizId = state(null);

		get quizId() {
			return get(this.#quizId);
		}

		set quizId(value) {
			set(this.#quizId, value, true);
		}

		#loaded = state(false);

		get loaded() {
			return get(this.#loaded);
		}

		set loaded(value) {
			set(this.#loaded, value, true);
		}

		#loadFailed = state(false);

		get loadFailed() {
			return get(this.#loadFailed);
		}

		set loadFailed(value) {
			set(this.#loadFailed, value, true);
		}

		#saveState = state("idle");

		get saveState() {
			return get(this.#saveState);
		}

		set saveState(value) {
			set(this.#saveState, value, true);
		}

		selection = new SvelteSet();
		#targetBlockId = state(null);

		get targetBlockId() {
			return get(this.#targetBlockId);
		}

		set targetBlockId(value) {
			set(this.#targetBlockId, value, true);
		}

		constructor(library = amqLibrary) {
			this.#library = library;
		}

		#totals = user_derived((// --- reads ---------------------------------------------------------------
		) => quizTotals(this.quiz, this.#library));

		get totals() {
			return get(this.#totals);
		}

		set totals(value) {
			set(this.#totals, value);
		}

		#songBudgetLeft = user_derived(() => MAX_SONG_COUNT - this.quiz.blocks.reduce((total, block) => total + block.songCount, 0));

		get songBudgetLeft() {
			return get(this.#songBudgetLeft);
		}

		set songBudgetLeft(value) {
			set(this.#songBudgetLeft, value);
		}

		#dirty = state(false);

		get dirty() {
			return get(this.#dirty);
		}

		set dirty(value) {
			set(this.#dirty, value, true);
		}

		#undoDepth = state(0);

		get undoDepth() {
			return get(this.#undoDepth);
		}

		set undoDepth(value) {
			set(this.#undoDepth, value, true);
		}

		#entryCount = user_derived(() => totalEntryCount(this.quiz));

		get entryCount() {
			return get(this.#entryCount);
		}

		set entryCount(value) {
			set(this.#entryCount, value);
		}

		#targetBlock = user_derived(() => this.quiz.blocks.find((block) => block.id === this.targetBlockId) ?? this.quiz.blocks[0]);

		get targetBlock() {
			return get(this.#targetBlock);
		}

		set targetBlock(value) {
			set(this.#targetBlock, value);
		}

		info(block) {
			return blockInfo(block, this.#library);
		}

		chosen(block) {
			return blockChosen(block, this.#library);
		}

		ceiling(block) {
			return songCountCeiling(this.quiz, block);
		}

		/** How many songs an entry can draw from. Sets the pick slider's range. */
		pool(entry) {
			if (entry.kind === "anime") {
				return this.#library.animeSongIds(entry.annId, entry.includeSongTypes).length;
			}

			return 1;
		}

		blockOf(entryId) {
			return this.quiz.blocks.find((block) => block.entries.some((entry) => entry.id === entryId));
		}

		/**
		 * The reason a block of this kind cannot be added now, or null when it can.
		 * The limits follow `customQuizBuilder.js:26-82`, so the UI can disable the
		 * action before AMQ rejects it.
		 */
		capReached(kind) {
			if (totalEntryCount(this.quiz) >= MAX_BLOCK_COUNT && kind !== "rule") {
				return `A quiz can hold ${MAX_BLOCK_COUNT} blocks.`;
			}

			switch (kind) {
				case "rule":
					if (this.quiz.blocks.length >= MAX_RULE_BLOCKS) {
						return `A quiz can hold ${MAX_RULE_BLOCKS} rule blocks.`;
					}
					if (this.songBudgetLeft <= 0) {
						return `All ${MAX_SONG_COUNT} songs are already assigned to rule blocks.`;
					}
					return null;

				case "algorithm":
					return countEntries(this.quiz, "algorithm") >= MAX_ALGORITHM_BLOCKS
						? `A quiz can hold ${MAX_ALGORITHM_BLOCKS} algorithm blocks.`
						: null;

				case "message":
					return countEntries(this.quiz, "message") >= MAX_MESSAGE_BLOCKS
						? `A quiz can hold ${MAX_MESSAGE_BLOCKS} message blocks.`
						: null;

				case "title":
					return countEntries(this.quiz, "title") >= MAX_TITLE_BLOCKS
						? `A quiz can hold ${MAX_TITLE_BLOCKS} title blocks.`
						: null;

				default:
					return null;
			}
		}

		// --- lifecycle -----------------------------------------------------------
		bind() {
			if (this.#unbind) return;

			this.#unbind = addListeners({
				"load custom quiz": (data) => this.#onLoaded(data),
				"save custom quiz": (data) => this.#onSaved(data),
				"get algorithm songs": (data) => this.#onAlgorithmSongs(data)
			});
		}

		unbind() {
			this.#unbind?.();
			this.#unbind = null;
		}

		/** A blank quiz with one empty rule block, as `setupNewQuiz` produces. */
		startNew() {
			this.quiz = emptyQuiz(nextId("block"));
			this.quizId = null;
			this.selection.clear();
			this.targetBlockId = this.quiz.blocks[0].id;
			this.loaded = true;
			this.loadFailed = false;
			this.saveState = "idle";
			this.#markSaved();
		}

		/** Marks the load as failed. Used when the library did not load. */
		failLoad() {
			this.loadFailed = true;
			this.loaded = true;
		}

		load(quizId) {
			this.loaded = false;
			this.loadFailed = false;
			this.quizId = quizId;
			sendCommand("quizCreator", "load custom quiz", { quizId });
		}

		#onLoaded(data) {
			if (data.failed || !data.quizSave) {
				this.loadFailed = true;
				this.loaded = true;

				return;
			}

			try {
				this.quiz = fromSave(data.quizSave);
			} catch(error) {
				console.error("[amq-ui] could not read this quiz", error);
				this.loadFailed = true;
				this.loaded = true;

				return;
			}

			this.quizId = data.quizId;
			this.selection.clear();
			this.targetBlockId = this.quiz.blocks[0]?.id ?? null;
			this.loaded = true;
			this.#markSaved();
		}

		/**
		 * Sends the quiz through AMQ's `save quiz` command. `QuizBuilder.svelte`
		 * checks the name before it opens the save dialog.
		 */
		save() {
			this.saveState = "saving";
			sendCommand("quizCreator", "save quiz", { quizSave: toSave(snapshot(this.quiz)), quizId: this.quizId });
		}

		#onSaved(data) {
			if (!data.success) {
				this.saveState = "failed";

				return;
			}

			if (data.quizId !== void 0) this.quizId = data.quizId;

			this.saveState = "saved";
			this.#markSaved();
		}

		/** Stores the matches on the algorithm entry whose id we sent. */
		#onAlgorithmSongs(data) {
			for (const block of this.quiz.blocks) {
				for (const entry of block.entries) {
					if (entry.kind === "algorithm" && entry.algorithmBlockId === data.blockId) {
						entry.matchedAnnSongIds = data.annSongIds;
					}
				}
			}
		}

		// --- undo ----------------------------------------------------------------
		/**
		 * Records an undo step and marks the quiz as changed. Every mutation calls
		 * it first.
		 */
		#checkpoint() {
			this.#history.push(snapshot(this.quiz));

			if (this.#history.length > UNDO_DEPTH) this.#history.shift();

			this.undoDepth = this.#history.length;
			this.dirty = true;
		}

		/**
		 * Undoes one mutation.
		 *
		 * Replaces the whole document, as `revert()` does. See the warning there
		 * about stale references.
		 */
		undo() {
			const previous = this.#history.pop();

			if (!previous) return false;

			this.undoDepth = this.#history.length;
			this.quiz = previous;

			for (const id of [...this.selection]) {
				if (!this.blockOf(id)) this.selection.delete(id);
			}

			this.dirty = this.#history.length > 0;

			return true;
		}

		/** Sets the current quiz as the saved state and clears the undo history. */
		#markSaved() {
			this.#saved = snapshot(this.quiz);
			this.#history = [];
			this.undoDepth = 0;
			this.dirty = false;
		}

		/**
		 * Discards every change since the last save.
		 *
		 * Replaces the whole document, so **any entry or block reference held
		 * across the call is stale** and edits to it are lost. Components re-read
		 * from `quiz` on every render. Code that caches an entry must look it up
		 * again by id.
		 *
		 * Cannot be undone. The caller must confirm first.
		 */
		revert() {
			if (!this.#saved) return false;

			this.quiz = structuredClone(this.#saved);
			this.selection.clear();
			this.targetBlockId = this.quiz.blocks[0]?.id ?? null;
			this.#history = [];
			this.undoDepth = 0;
			this.dirty = false;

			return true;
		}

		// --- rule blocks ---------------------------------------------------------
		addRuleBlock() {
			if (this.capReached("rule")) return null;

			this.#checkpoint();

			const block = defaultRuleBlock(nextId("block"));

			block.songCount = Math.min(block.songCount, this.songBudgetLeft);
			this.quiz.blocks.push(block);

			return this.quiz.blocks[this.quiz.blocks.length - 1];
		}

		/** AMQ refuses to delete the last rule block. So do we. */
		removeRuleBlock(blockId) {
			if (this.quiz.blocks.length <= 1) return false;

			this.#checkpoint();

			const block = this.quiz.blocks.find((entry) => entry.id === blockId);

			for (const entry of block?.entries ?? []) this.selection.delete(entry.id);

			this.quiz.blocks = this.quiz.blocks.filter((entry) => entry.id !== blockId);

			if (this.targetBlockId === blockId) {
				this.targetBlockId = this.quiz.blocks[0]?.id ?? null;
			}

			return true;
		}

		/**
		 * SPEC §7: the copy carries the entries, nested blocks, settings and
		 * overrides, and goes directly after the original.
		 */
		duplicateRuleBlock(blockId) {
			if (this.capReached("rule")) return null;

			const index = this.quiz.blocks.findIndex((block) => block.id === blockId);

			if (index === -1) return null;

			this.#checkpoint();

			const source = snapshot(this.quiz.blocks[index]);

			const copy = {
				...source,
				id: nextId("block"),
				songCount: Math.min(source.songCount, this.songBudgetLeft),
				entries: source.entries.map((entry) => this.#copyEntry(entry))
			};

			this.quiz.blocks.splice(index + 1, 0, copy);

			return this.quiz.blocks[index + 1];
		}

		/**
		 * A detached copy of an entry with a new id.
		 *
		 * Uses `$state.snapshot`, not `structuredClone`: entries are deep reactive
		 * proxies, and `structuredClone` can throw on one.
		 */
		#copyEntry(entry) {
			const plain = snapshot(entry);

			return { ...plain, id: nextId(entry.kind) };
		}

		// --- block settings ------------------------------------------------------
		updateBlock(blockId, patch) {
			const block = this.quiz.blocks.find((entry) => entry.id === blockId);

			if (!block) return;

			this.#checkpoint();
			Object.assign(block, patch);
		}

		/** Clamped to what the 250-song limit leaves for this block. */
		setSongCount(blockId, value) {
			const block = this.quiz.blocks.find((entry) => entry.id === blockId);

			if (!block) return;

			this.#checkpoint();
			block.songCount = Math.max(1, Math.min(Math.round(value), this.ceiling(block)));
		}

		// --- entries -------------------------------------------------------------
		/** Adds to the "Adds to" block unless `blockId` is given (SPEC §7). */
		addEntry(entry, blockId) {
			const block = this.quiz.blocks.find((item) => item.id === (blockId ?? this.targetBlockId)) ?? this.quiz.blocks[0];

			if (!block) return null;
			if (this.capReached(entry.kind)) return null;

			this.#checkpoint();

			const created = { ...entry, id: nextId(entry.kind) };

			block.entries.push(created);

			return block.entries[block.entries.length - 1];
		}

		removeEntries(ids) {
			const doomed = new Set(ids);

			if (doomed.size === 0) return;

			this.#checkpoint();

			for (const block of this.quiz.blocks) {
				block.entries = block.entries.filter((entry) => !doomed.has(entry.id));

				if (block.entries.length > 0) block.entries[0].connectUp = false;
			}

			for (const id of doomed) this.selection.delete(id);
		}

		/**
		 * SPEC §6: a move keeps each entry's overrides and the entries' order.
		 *
		 * `at` inserts before that index in the target block. Omitted or -1
		 * appends. The index is adjusted for moved entries that sat above it in the
		 * target block, because removing them shifts the drop point.
		 */
		moveEntries(ids, toBlockId, at = -1) {
			const moving = new Set(ids);
			const target = this.quiz.blocks.find((block) => block.id === toBlockId);

			if (!target || moving.size === 0) return;

			this.#checkpoint();

			let removedBefore = 0;

			if (at >= 0) {
				target.entries.forEach((entry, index) => {
					if (index < at && moving.has(entry.id)) removedBefore += 1;
				});
			}

			const taken = [];

			for (const block of this.quiz.blocks) {
				const keep = [];

				for (const entry of block.entries) {
					if (moving.has(entry.id)) taken.push(entry); else keep.push(entry);
				}

				block.entries = keep;

				if (block.entries.length > 0) block.entries[0].connectUp = false;
			}

			if (at < 0) {
				target.entries.push(...taken);
			} else {
				target.entries.splice(Math.max(0, at - removedBefore), 0, ...taken);
			}

			if (target.entries.length > 0) target.entries[0].connectUp = false;
		}

		duplicateEntries(ids) {
			const wanted = new Set(ids);

			if (wanted.size === 0) return;

			for (const id of wanted) {
				const entry = this.#entry(id);

				if (entry && this.capReached(entry.kind)) return;
			}

			this.#checkpoint();

			for (const block of this.quiz.blocks) {
				const out = [];

				for (const entry of block.entries) {
					out.push(entry);

					if (wanted.has(entry.id)) {
						out.push({ ...this.#copyEntry(entry), connectUp: false });
					}
				}

				block.entries = out;
			}
		}

		#entry(entryId) {
			for (const block of this.quiz.blocks) {
				const found = block.entries.find((entry) => entry.id === entryId);

				if (found) return found;
			}

			return void 0;
		}

		toggleLock(entryId) {
			const entry = this.#entry(entryId);

			if (!entry) return;

			this.#checkpoint();
			entry.locked = !entry.locked;
		}

		setLocked(ids, locked) {
			this.#checkpoint();

			for (const id of ids) {
				const entry = this.#entry(id);

				if (entry) entry.locked = locked;
			}
		}

		/**
		 * SPEC §5.5: the chain button sits between two rows and toggles
		 * `connectUp` on the *lower* entry. The first entry of a block has nothing
		 * above it and cannot be chained.
		 */
		toggleChain(entryId) {
			const block = this.blockOf(entryId);

			if (!block) return;

			const index = block.entries.findIndex((entry) => entry.id === entryId);

			if (index <= 0) return;

			this.#checkpoint();
			block.entries[index].connectUp = !block.entries[index].connectUp;
		}

		// --- anime entry controls ------------------------------------------------
		/**
		 * SPEC §5.6: toggling a type clamps the pick count at once, so it never
		 * exceeds the pool.
		 */
		toggleSongType(entryId, type) {
			const entry = this.#entry(entryId);

			if (entry?.kind !== "anime") return;

			this.#checkpoint();
			entry.includeSongTypes[type] = !entry.includeSongTypes[type];
			entry.numberOfSongs = clampPick(entry.numberOfSongs, this.pool(entry));
		}

		setNumberOfSongs(entryId, value) {
			const entry = this.#entry(entryId);

			if (entry?.kind !== "anime") return;

			this.#checkpoint();
			entry.numberOfSongs = clampPick(Math.round(value), this.pool(entry));
		}

		/**
		 * Stores the settings AMQ's host modal produced for an algorithm block and
		 * requests a new match count.
		 *
		 * The settings are stored unchanged. Never inspect or normalise them: a
		 * field we do not know would be lost.
		 */
		updateAlgorithmSettings(entryId, settings) {
			const entry = this.#entry(entryId);

			if (entry?.kind !== "algorithm") return;

			this.#checkpoint();
			entry.settings = settings;
			entry.matchedAnnSongIds = void 0;
			this.requestAlgorithmSongs(entry.id);
		}

		/** Requests the songs an algorithm block matches. */
		requestAlgorithmSongs(entryId) {
			const entry = this.#entry(entryId);

			if (entry?.kind !== "algorithm") return;

			if (entry.algorithmBlockId === void 0) {
				nextAlgorithmId += 1;
				entry.algorithmBlockId = nextAlgorithmId;
			}

			sendCommand("quizCreator", "get algorithm songs", {
				settings: snapshot(entry.settings),
				blockId: entry.algorithmBlockId
			});
		}

		// --- per-entry overrides -------------------------------------------------
		/** Applies an override to every given play entry (SPEC §8's footer). */
		setOverride(ids, key, value) {
			this.#checkpoint();

			for (const id of ids) {
				const entry = this.#entry(id);

				if (entry && "overrides" in entry) {
					entry.overrides[key] = value;
				}
			}
		}

		/** "Reset to block". An entry with no override key follows its block. */
		clearOverride(ids, key) {
			this.#checkpoint();

			for (const id of ids) {
				const entry = this.#entry(id);

				if (!entry || !("overrides" in entry)) continue;

				const play = entry;

				if (key) delete play.overrides[key]; else play.overrides = {};
			}
		}

		/**
		 * At least one guess mode must stay on. AMQ refuses to turn the last one
		 * off, and so do we.
		 */
		static toggleGuessMode(modes, key) {
			const next = { ...modes, [key]: !modes[key] };

			if (!next.song && !next.tinyVideo && !next.blurVideo) return modes;

			return next;
		}

		// --- selection -----------------------------------------------------------
		/** Entry ids in render order, for shift-range selection. */
		get flatIds() {
			return this.quiz.blocks.flatMap((block) => block.entries.map((entry) => entry.id));
		}

		toggleSelected(id) {
			if (this.selection.has(id)) this.selection.delete(id); else this.selection.add(id);
		}

		/** A shift-click range can span blocks (SPEC §6). */
		selectRange(fromId, toId) {
			const ids = this.flatIds;
			const start = ids.indexOf(fromId);
			const end = ids.indexOf(toId);

			if (start === -1 || end === -1) return;

			const [low, high] = start <= end ? [start, end] : [end, start];

			for (let index = low; index <= high; index += 1) {
				this.selection.add(ids[index]);
			}
		}

		selectBlock(blockId, selected) {
			const block = this.quiz.blocks.find((entry) => entry.id === blockId);

			if (!block) return;

			for (const entry of block.entries) {
				if (selected) this.selection.add(entry.id); else this.selection.delete(entry.id);
			}
		}

		clearSelection() {
			this.selection.clear();
		}
	}

	const quizStore = new QuizStore();

	/* dnd.svelte.ts generated by Svelte v5.57.0 */

	class DragState {
		#ids = /** Ids of the dragged entries. Null when no drag is active. */
		state(null);

		get ids() {
			return get(this.#ids);
		}

		set ids(value) {
			set(this.#ids, value, true);
		}

		#over = state(null);

		get over() {
			return get(this.#over);
		}

		set over(value) {
			set(this.#over, value, true);
		}

		#active = user_derived(() => this.ids !== null);

		get active() {
			return get(this.#active);
		}

		set active(value) {
			set(this.#active, value);
		}

		#count = user_derived(() => this.ids?.length ?? 0);

		get count() {
			return get(this.#count);
		}

		set count(value) {
			set(this.#count, value);
		}

		start(entryId) {
			if (quizStore.selection.has(entryId)) {
				this.ids = [...quizStore.selection];
			} else {
				quizStore.clearSelection();
				quizStore.toggleSelected(entryId);
				this.ids = [entryId];
			}
		}

		enter(target) {
			if (!this.ids) return;

			this.over = target;
		}

		leave(blockId) {
			if (this.over?.blockId === blockId) this.over = null;
		}

		/** Applies the move. Does nothing without a target. */
		drop() {
			const ids = this.ids;
			const target = this.over;

			this.cancel();

			if (!ids || !target) return;

			quizStore.moveEntries(ids, target.blockId, target.index);
		}

		cancel() {
			this.ids = null;
			this.over = null;
		}
	}

	const dragState = new DragState();

	/* debug.svelte.ts generated by Svelte v5.57.0 */

	const LOG_THROTTLE_MS = 1e3;

	function summarise(room) {
		return {
			id: room.id,
			name: room.name,
			host: room.host,
			mode: room.mode,
			players: `${room.playerCount}/${room.roomSize}`,
			spectators: room.spectatorCount,
			state: room.inLobby ? "lobby" : `playing (${room.songsLeft} left)`,
			songs: room.songCount,
			guessTime: room.guessTime.range ? rangeLabel(room.guessTime.range) : "-",
			selection: room.songSelection,
			types: ["openings", "endings", "inserts"].filter((type) => room.songTypes[type]).map((type) => type[0].toUpperCase()).join("") || "-",
			private: room.isPrivate,
			friends: room.friendNames.length
		};
	}

	function startRoomLogging() {
		return effect_root(() => {
			let last = 0;
			let pending = null;

			user_effect(() => {
				const rooms = roomStore.rooms;

				if (!roomStore.loaded) return;

				const flush = () => {
					last = Date.now();
					pending = null;
					console.groupCollapsed(`[amq-ui] ${rooms.length} rooms, ${roomStore.playerCount} players`);
					console.table(rooms.map(summarise));
					console.groupEnd();
				};

				const elapsed = Date.now() - last;

				if (elapsed >= LOG_THROTTLE_MS) {
					flush();
				} else if (!pending) {
					pending = setTimeout(flush, LOG_THROTTLE_MS - elapsed);
				}
			});
		});
	}

	const quizBuilderApi = {
		fromSave,
		toSave,
		/** What saving this payload back would produce. */
		roundTrip: (save) => toSave(fromSave(save)),

		/**
		 * Fields the server adds on load that a save never carries. The live suite
		 * reads them from here so it strips the same set as the serializer.
		 */
		serverOnlyFields: {
			quiz: [...SERVER_ONLY_QUIZ_FIELDS],
			block: [...SERVER_ONLY_BLOCK_FIELDS],
			entry: [...SERVER_ONLY_ENTRY_FIELDS]
		},
		dragState,
		libraryStore,
		/** Library entries we could not read. Non-zero means the payload changed. */
		unreadable: unreadableAnimeCount,
		libraryFilters,
		bumpCache,
		/** A store on a supplied library. Needs no cached library and no socket. */
		makeStore: (library) => {
			const store = new QuizStore(library);

			store.startNew();

			return store;
		},
		QuizStore
	};

	function exposeDebugApi(hooks) {
		const { quizBuilderScreen, ...roomBrowserHooks } = hooks;

		_unsafeWindow.__amqUI = {
			...roomBrowserHooks,
			store: roomStore,
			get rooms() {
				return roomStore.rooms;
			},
			table: () => console.table(roomStore.rooms.map(summarise)),
			refresh: () => roomStore.refresh(),
			/** Returns the disposer. */
			startLogging: startRoomLogging,

			/** Opens a player profile the same way a room row does. */
			profile: (name) => openProfile(document.body, name),
			quizBuilder: { ...quizBuilderApi, ...quizBuilderScreen, store: quizStore }
		};
	}

	const styles = ":host{all:initial;display:block;font-family:var(--font-ui);color:var(--text)}*,*:before,*:after{box-sizing:border-box}.amq-ui-root{--bg-top: rgba(11, 14, 20, .82);--bg-strip: rgba(11, 14, 20, .58);--bg-head: rgba(9, 12, 18, .92);--bg-list: rgba(13, 17, 25, .8);--bg-row: rgba(255, 255, 255, .022);--bg-row-hover: rgba(255, 255, 255, .045);--bg-pop: rgba(10, 13, 19, .98);--bg-sunken: rgba(0, 0, 0, .34);--bg-raised: rgba(255, 255, 255, .07);--line: rgba(255, 255, 255, .055);--line-soft: rgba(255, 255, 255, .1);--line-strong: rgba(255, 255, 255, .16);--text: #eef1f6;--text-2: #cdd4e0;--text-3: #98a1b0;--text-4: #8a93a3;--text-5: #6f7889;--accent: #5b9bf5;--accent-fg: #07101f;--accent-soft: #a7cbfa;--teal: #34c9a3;--teal-fg: #6fdcbd;--amber: #e8a33d;--amber-fg: #f0bd70;--violet: #9b7cf5;--violet-fg: #b6a0fa;--rose: #e5658a;--rose-fg: #f08aa8;--blue-fg: #8dbcf8;--cyan: #3fb9d6;--cyan-fg: #6fd3e8;--chip-teal-bg: rgba(52, 201, 163, .14);--chip-teal-line: rgba(52, 201, 163, .34);--chip-amber-bg: rgba(232, 163, 61, .13);--chip-amber-line: rgba(232, 163, 61, .32);--chip-violet-bg: rgba(155, 124, 245, .15);--chip-violet-line: rgba(155, 124, 245, .4);--chip-rose-bg: rgba(229, 101, 138, .13);--chip-rose-line: rgba(229, 101, 138, .36);--chip-blue-bg: rgba(91, 155, 245, .13);--chip-blue-line: rgba(91, 155, 245, .32);--chip-off-bg: rgba(255, 255, 255, .045);--chip-off-line: rgba(255, 255, 255, .1);--chip-off-fg: #7d8695;--font-ui: \"IBM Plex Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif;--font-mono: \"IBM Plex Mono\", ui-monospace, \"SF Mono\", Menlo, monospace;--font-display: \"Bricolage Grotesque\", \"IBM Plex Sans\", system-ui, sans-serif;--radius: 8px;--gutter: 24px;--col-id: 64px;--col-identity: 250px;--col-mode: 136px;--col-selection: 96px;--col-types: 104px;--col-players: 88px;--col-songs: 96px;--col-time: 88px;--col-difficulty: 108px;--col-chips: 220px;--col-action: 200px;--col-gap: 10px;--row-pad: 14px;--qb-text: 14px;--qb-text-sm: 12.5px;--qb-text-xs: 11.5px;--qb-badge: 12px;--qb-chain: 16px;--qb-grip: 12px;--qb-check: 15px;--qb-anime-min: 120px;--qb-song-min: 160px;--qb-types: 156px;--qb-pick: 88px;--qb-overrides: 148px;--qb-actions: 108px;--qb-row-gap: 9px;--qb-entry-h: 44px;--qb-row-pad-left: 11px;--qb-check-x: calc( var(--qb-row-pad-left) + var(--qb-chain) + var(--qb-row-gap) + var(--qb-grip) + var(--qb-row-gap) );--qb-lib-lead: 24px;--qb-lib-song-lead: 52px;--qb-lib-count: 64px;--qb-lib-action: 120px;--qb-lib-anime-h: 52px;--qb-lib-song-h: 46px;--qb-band-h: 50px;color:var(--text);font-family:var(--font-ui);font-size:15px;line-height:1.4}.amq-ui-root ::-webkit-scrollbar{width:11px;height:11px}.amq-ui-root ::-webkit-scrollbar-track{background:transparent}.amq-ui-root ::-webkit-scrollbar-thumb{background:#ffffff21;border:3px solid transparent;background-clip:padding-box;border-radius:6px}.amq-ui-root ::-webkit-scrollbar-thumb:hover{background:#ffffff3d;background-clip:padding-box}.amq-ui-root ::-webkit-scrollbar-corner{background:transparent}.amq-ui-root,.amq-ui-root *{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.16) transparent}.amq-ui-root :focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}.amq-ui-root button{font-family:inherit}.amq-ui-root .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.amq-ui-root .mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums}";

	let sheet = null;
	function styleSheet() {
	  if (!sheet) {
	    sheet = new CSSStyleSheet();
	    sheet.replaceSync(styles);
	  }
	  return sheet;
	}
	function mountShadowApp(parent, component, props) {
	  const host = document.createElement("div");
	  host.dataset.amqUi = "";
	  host.style.display = "none";
	  parent.appendChild(host);
	  const root = host.attachShadow({ mode: "open" });
	  root.adoptedStyleSheets = [styleSheet()];
	  const container = document.createElement("div");
	  container.className = "amq-ui-root";
	  root.appendChild(container);
	  const instance = mount(component, { target: container, props });
	  return {
	    host,
	    root,
	    show: () => host.style.display = "",
	    hide: () => host.style.display = "none",
	    destroy: () => {
	      unmount(instance);
	      host.remove();
	    }
	  };
	}

	function requireController(name) {
	  const original = viewChanger.__controllers[name];
	  if (!original) {
	    throw new Error(`[amq-ui] no such view controller: ${name}`);
	  }
	  return original;
	}
	function replaceViewController(name, controller) {
	  const original = requireController(name);
	  viewChanger.__controllers[name] = Object.assign(
	    Object.create(original),
	    controller
	  );
	  return () => {
	    viewChanger.__controllers[name] = original;
	  };
	}

	function createScreen(options) {
	  const {
	    view,
	    component,
	    props,
	    onOpen,
	    onClose,
	    extra,
	    zIndex = 100
	  } = options;
	  let app = null;
	  let restore = null;
	  function mount() {
	    if (app) return app;
	    app = mountShadowApp(document.body, component, props);
	    app.host.style.position = "relative";
	    app.host.style.zIndex = String(zIndex);
	    return app;
	  }
	  function reopenCurrentView() {
	    if (viewChanger.getCurrentView() !== view) return;
	    viewChanger.__controllers[view].openView(() => {
	      viewChanger.hideLoadingScreen();
	    });
	  }
	  function install() {
	    if (restore) return;
	    const original = viewChanger.__controllers[view];
	    restore = replaceViewController(view, {
	      ...extra?.(original) ?? {},
	      openView(callback, arg) {
	        try {
	          onOpen?.(arg);
	        } catch (error) {
	          console.error(`[amq-ui] ${view} onOpen failed`, error);
	        }
	        mount().show();
	        callback();
	      },
	      closeView() {
	        app?.hide();
	        try {
	          onClose?.();
	        } catch (error) {
	          console.error(`[amq-ui] ${view} onClose failed`, error);
	        }
	      }
	    });
	  }
	  function useLegacy() {
	    if (!restore) return;
	    app?.hide();
	    onClose?.();
	    restore();
	    restore = null;
	    reopenCurrentView();
	    console.log(`[amq-ui] ${view} handed back to AMQ`);
	  }
	  function useNew() {
	    if (restore) return;
	    if (viewChanger.getCurrentView() === view) {
	      viewChanger.__controllers[view].closeView({});
	    }
	    install();
	    reopenCurrentView();
	    console.log(`[amq-ui] ${view} is ours again`);
	  }
	  return {
	    view,
	    get installed() {
	      return restore !== null;
	    },
	    install,
	    useLegacy,
	    useNew,
	    app: () => app
	  };
	}

	const FONT_HREF = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
	const MARKER = "amqUiFonts";
	function installFonts() {
	  if (document.head.querySelector(`link[data-${MARKER.toLowerCase()}]`)) return;
	  const link = document.createElement("link");
	  link.rel = "stylesheet";
	  link.href = FONT_HREF;
	  link.dataset[MARKER] = "";
	  document.head.appendChild(link);
	}

	// generated during release, do not modify

	const PUBLIC_VERSION = '5';

	if (typeof window !== 'undefined') {
		// @ts-expect-error
		((window.__svelte ??= {}).v ??= new Set()).add(PUBLIC_VERSION);
	}

	var root$y = from_html(`<div role="presentation"><!></div>`);

	const $$css$x = {
		hash: 'svelte-1rmt7tb',
		code: '.floating.svelte-1rmt7tb {position:fixed;z-index:200;box-sizing:border-box;padding:8px 10px;border-radius:var(--radius);background:var(--bg-pop);border:1px solid var(--line-strong);box-shadow:0 8px 22px rgba(0, 0, 0, 0.55);color:var(--text);text-align:left;\n    /* Hidden until measured, so it never appears in the wrong place. */visibility:hidden;}.floating.placed.svelte-1rmt7tb {visibility:visible;}'
	};

	function Floating($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$x);

		/** Preferred side. Flips when the panel does not fit. */
		/** The edge of the anchor that the panel aligns with. */
		/**
		 * Close when a pointer goes down outside the panel. On by default: a
		 * panel that stays open covers the page and takes every later click.
		 */
		let placement = prop($$props, 'placement', 3, 'below'),
			align = prop($$props, 'align', 3, 'start'),
			maxWidth = prop($$props, 'maxWidth', 3, 260),
			dismissOnOutside = prop($$props, 'dismissOnOutside', 3, true);

		const GAP = 6;
		const MARGIN = 8;
		let panel = state(null);
		let left = state(0);
		let top = state(0);
		let placed = state(false);

		user_effect(() => {
			const element = get(panel);

			if (!element || !$$props.anchor) return;

			const position = () => {
				const from = $$props.anchor.getBoundingClientRect();
				const box = element.getBoundingClientRect();
				let x = align() === 'end' ? from.right - box.width : from.left;

				x = Math.min(Math.max(MARGIN, x), window.innerWidth - box.width - MARGIN);

				const below = from.bottom + GAP;
				const above = from.top - box.height - GAP;

				// Use the preferred side unless the panel would leave the viewport.
				// Then use the side that has room.
				const fitsBelow = below + box.height <= window.innerHeight - MARGIN;

				const fitsAbove = above >= MARGIN;
				let y;

				if (placement() === 'below') y = fitsBelow || !fitsAbove ? below : above; else y = fitsAbove || !fitsBelow ? above : below;

				set(left, Math.round(x), true);
				set(top, Math.round(y), true);
				set(placed, true);
			};

			position();

			// Measure again once fonts and images have set the panel's final size.
			const frame = requestAnimationFrame(position);

			// A scroll moves the anchor, so close the panel.
			const dismiss = () => $$props.onDismiss?.();

			window.addEventListener('scroll', dismiss, true);
			window.addEventListener('resize', dismiss);

			/*
			 * Use `composedPath()`, not `event.target`. The panel is in a shadow
			 * root, so a document listener sees the host element as the target of
			 * any click inside it, and every click on the panel would count as
			 * outside.
			 *
			 * The anchor is excluded. Its own handler closes the panel, and a second
			 * dismiss here would close and reopen it.
			 */
			const onPointerDown = (event) => {
				if (!dismissOnOutside()) return;

				const path = event.composedPath();

				if (path.includes(element)) return;
				if ($$props.anchor && path.includes($$props.anchor)) return;

				$$props.onDismiss?.();
			};

			document.addEventListener('pointerdown', onPointerDown, true);

			return () => {
				cancelAnimationFrame(frame);
				window.removeEventListener('scroll', dismiss, true);
				window.removeEventListener('resize', dismiss);
				document.removeEventListener('pointerdown', onPointerDown, true);
			};
		});

		var div = root$y();
		let classes;
		let styles;
		var node = child(div);

		snippet(node, () => $$props.children);
		bind_this(div, ($$value) => set(panel, $$value), () => get(panel));

		template_effect(() => {
			classes = set_class(div, 1, 'floating svelte-1rmt7tb', null, classes, { placed: get(placed) });

			styles = set_style(div, '', styles, {
				left: `${get(left) ?? ''}px`,
				top: `${get(top) ?? ''}px`,
				width: $$props.width ? `${$$props.width}px` : undefined,
				'max-width': `${maxWidth() ?? ''}px`
			});
		});

		event('mouseenter', div, function (...$$args) {
			$$props.onEnter?.apply(this, $$args);
		});

		event('mouseleave', div, function (...$$args) {
			$$props.onLeave?.apply(this, $$args);
		});

		append($$anchor, div);
		pop();
	}

	const TONES = ["accent", "violet", "teal", "amber", "rose"];
	function toneFor(index) {
	  return TONES[index % TONES.length];
	}
	function isRowEntry(entry) {
	  return entry.kind === "anime" || entry.kind === "song";
	}
	function buildRows(quiz, options = {}) {
	  const { collapsed, targetBlockId, matches } = options;
	  const rows = [];
	  quiz.blocks.forEach((block, blockIndex) => {
	    const tone = toneFor(blockIndex);
	    const base = { block, blockIndex, tone };
	    rows.push({
	      ...base,
	      kind: "block",
	      id: `block:${block.id}`,
	      position: blockIndex + 1,
	      isTarget: block.id === targetBlockId
	    });
	    if (collapsed?.has(block.id)) return;
	    block.entries.forEach((entry, indexInBlock) => {
	      if (matches && !matches(entry)) return;
	      if (isRowEntry(entry)) {
	        const previous = block.entries[indexInBlock - 1];
	        const next = block.entries[indexInBlock + 1];
	        const canChainUp = indexInBlock > 0 && previous !== void 0 && isRowEntry(previous);
	        rows.push({
	          ...base,
	          kind: "entry",
	          id: entry.id,
	          entry,
	          indexInBlock,
	          canChainUp,
	          chainedUp: canChainUp && entry.connectUp,
	          chainedDown: next !== void 0 && isRowEntry(next) && next.connectUp
	        });
	        return;
	      }
	      rows.push({
	        ...base,
	        kind: "nested",
	        id: entry.id,
	        entry,
	        indexInBlock
	      });
	    });
	    rows.push({
	      ...base,
	      kind: "footer",
	      id: `footer:${block.id}`,
	      empty: block.entries.length === 0
	    });
	  });
	  return rows;
	}

	var root$x = from_html(`<button type="button"><span aria-hidden="true"></span> <span class="label svelte-1t2ejif"> </span> <span class="count mono svelte-1t2ejif"> </span></button>`);
	var root_1$t = from_html(`<p class="why svelte-1t2ejif"> </p>`);
	var root_2$n = from_html(`<div class="menu svelte-1t2ejif"><!> <div class="sep svelte-1t2ejif"></div> <button type="button" class="item new svelte-1t2ejif">+ New rule block</button> <!></div>`);

	const $$css$w = {
		hash: 'svelte-1t2ejif',
		code: '.menu.svelte-1t2ejif {display:flex;flex-direction:column;gap:1px;padding:5px;}.item.svelte-1t2ejif {display:flex;align-items:center;gap:8px;width:100%;height:28px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text-2);font-family:inherit;font-size:12px;text-align:left;cursor:pointer;}.item.svelte-1t2ejif:hover:not(:disabled) {background:var(--bg-raised);color:var(--text);}.item.on.svelte-1t2ejif {background:var(--chip-blue-bg);color:var(--blue-fg);}.item.svelte-1t2ejif:disabled {opacity:0.45;cursor:default;}.dot.svelte-1t2ejif {flex:none;width:7px;height:7px;border-radius:50%;background:var(--tone);}.tone-accent.svelte-1t2ejif {--tone: var(--accent);}.tone-violet.svelte-1t2ejif {--tone: var(--violet);}.tone-teal.svelte-1t2ejif {--tone: var(--teal);}.tone-amber.svelte-1t2ejif {--tone: var(--amber);}.tone-rose.svelte-1t2ejif {--tone: var(--rose);}.label.svelte-1t2ejif {flex:1 1 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.count.svelte-1t2ejif {flex:none;font-size:10.5px;color:var(--text-5);}.sep.svelte-1t2ejif {height:1px;margin:4px 2px;background:var(--line);}.new.svelte-1t2ejif {font-weight:600;color:var(--blue-fg);}.why.svelte-1t2ejif {margin:2px 6px 4px;font-size:10px;color:var(--text-5);}'
	};

	function BlockPicker($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$w);

		/** The block to highlight as the current choice. */
		let currentId = prop($$props, 'currentId', 3, null);

		const blocked = user_derived(() => quizStore.capReached('rule'));

		function createAndPick() {
			const block = quizStore.addRuleBlock();

			if (block) $$props.onPick(block.id);
		}

		Floating($$anchor, {
			get anchor() {
				return $$props.anchor;
			},
			placement: 'below',
			align: 'start',
			width: 250,
			get onDismiss() {
				return $$props.onDismiss;
			},

			children: ($$anchor, $$slotProps) => {
				var div = root_2$n();
				var node = child(div);

				each(node, 19, () => quizStore.quiz.blocks, (block) => block.id, ($$anchor, block, index) => {
					var button = root$x();
					let classes;
					var span = child(button);
					var span_1 = sibling(span, 2);
					var text = only_child(span_1);
					var span_2 = sibling(span_1, 2);
					var text_1 = only_child(span_2, true);

					template_effect(
						($0, $1) => {
							classes = set_class(button, 1, 'item svelte-1t2ejif', null, classes, { on: get(block).id === currentId() });
							set_class(span, 1, `dot tone-${$0 ?? ''}`, 'svelte-1t2ejif');

							set_text(text, `${$1 ?? ''}
          ${get(index) + 1}`);

							set_text(text_1, get(block).entries.length);
						},
						[
							() => toneFor(get(index)),
							() => t('quiz_builder.rule_block.title', 'Rule Block')
						]
					);

					delegated('click', button, () => $$props.onPick(get(block).id));
					append($$anchor, button);
				});

				var button_1 = sibling(node, 4);
				var node_1 = sibling(button_1, 2);

				{
					var consequent = ($$anchor) => {
						var p = root_1$t();
						var text_2 = only_child(p, true);

						template_effect(() => set_text(text_2, get(blocked)));
						append($$anchor, p);
					};

					if_block(node_1, ($$render) => {
						if (get(blocked)) $$render(consequent);
					});
				}

				template_effect(() => {
					button_1.disabled = get(blocked) !== null;
					set_attribute(button_1, 'title', get(blocked) ?? undefined);
				});

				delegated('click', button_1, createAndPick);
				append($$anchor, div);
			},
			$$slots: { default: true }
		});

		pop();
	}

	delegate(['click']);

	var root$w = from_svg(`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>`);
	var root_1$s = from_svg(`<circle cx="11" cy="11" r="7"></circle>`);
	var root_2$m = from_svg(`<rect x="5" y="11" width="14" height="10" rx="2"></rect>`);
	var root_3$g = from_svg(`<circle cx="12" cy="12" r="2.4"></circle>`);
	var root_4$b = from_svg(`<circle cx="16" cy="8" r="2.2"></circle><circle cx="10" cy="16" r="2.2"></circle>`, 1);
	var root_5$a = from_svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><!><path></path></svg>`);

	function Icon($$anchor, $$props) {
		let size = prop($$props, 'size', 3, 15),
			strokeWidth = prop($$props, 'strokeWidth', 3, 2.2);

		const PATHS = {
			back: 'M15 18l-6-6 6-6',
			search: 'M20 20l-3.5-3.5',
			filter: 'M4 6h16M7 12h10M10 18h4',
			plus: 'M12 5v14M5 12h14',
			close: 'M6 6l12 12M18 6L6 18',
			check: 'M5 13l4.5 4.5L19 7',
			lock: 'M8 11V7.5a4 4 0 018 0V11',
			eye: 'M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z',
			play: '',
			caret: 'M6 9l6 6 6-6',
			// The row's "All settings" button.
			sliders: 'M4 8h10M18 8h2M4 16h4M12 16h8',

			// Two offset sheets. Do not use a "+" for duplicate: it reads as "add".
			copy: 'M9 9h10v10H9zM5 15H4V4h11v1',
			undo: 'M4 9h11a4.5 4.5 0 010 9h-6M4 9l4-4M4 9l4 4'
		};

		var fragment = comment();
		var node = first_child(fragment);

		{
			var consequent = ($$anchor) => {
				var svg = root$w();

				template_effect(() => {
					set_attribute(svg, 'width', size());
					set_attribute(svg, 'height', size());
				});

				append($$anchor, svg);
			};

			var alternate = ($$anchor) => {
				var svg_1 = root_5$a();
				var node_1 = child(svg_1);

				{
					var consequent_1 = ($$anchor) => {
						var circle = root_1$s();

						append($$anchor, circle);
					};

					var consequent_2 = ($$anchor) => {
						var rect = root_2$m();

						append($$anchor, rect);
					};

					var consequent_3 = ($$anchor) => {
						var circle_1 = root_3$g();

						append($$anchor, circle_1);
					};

					var consequent_4 = ($$anchor) => {
						var fragment_1 = root_4$b();
						append($$anchor, fragment_1);
					};

					if_block(node_1, ($$render) => {
						if ($$props.name === 'search') $$render(consequent_1); else if ($$props.name === 'lock') $$render(consequent_2, 1); else if ($$props.name === 'eye') $$render(consequent_3, 2); else if ($$props.name === 'sliders') $$render(consequent_4, 3);
					});
				}

				var path = sibling(node_1);

				template_effect(() => {
					set_attribute(svg_1, 'width', size());
					set_attribute(svg_1, 'height', size());
					set_attribute(svg_1, 'stroke-width', strokeWidth());
					set_attribute(path, 'd', PATHS[$$props.name]);
				});

				append($$anchor, svg_1);
			};

			if_block(node, ($$render) => {
				if ($$props.name === 'play') $$render(consequent); else $$render(alternate, -1);
			});
		}

		append($$anchor, fragment);
	}

	function formatMaybeRandom(value) {
	  return Array.isArray(value) ? `${value[0]}–${value[1]}` : String(value);
	}
	function isRandom(value) {
	  return Array.isArray(value);
	}
	function guessModeNames(modes) {
	  const names = [];
	  if (modes.song)
	    names.push(t("quiz_builder.rule_block.guess_mode.song", "Song"));
	  if (modes.tinyVideo) {
	    names.push(t("quiz_builder.rule_block.guess_mode.tiny_video", "Tiny Video"));
	  }
	  if (modes.blurVideo) {
	    names.push(t("quiz_builder.rule_block.guess_mode.blur_video", "Blur Video"));
	  }
	  return names;
	}
	function isSongOnly(modes) {
	  return modes.song && !modes.tinyVideo && !modes.blurVideo;
	}
	function overrideChips(overrides) {
	  const chips = [];
	  if (overrides.guessTime) {
	    const { guessTime, extraGuessTime } = overrides.guessTime;
	    const extra = extraGuessTime === 0 ? "" : ` +${formatMaybeRandom(extraGuessTime)}s`;
	    chips.push({
	      key: "guessTime",
	      label: `${formatMaybeRandom(guessTime)}s${extra}`,
	      tooltip: `${t("quiz_builder.rule_labels.guess_time", "Guess Time")} — ${t(
        "quiz_builder.rule_labels.override_guess_time",
        "Override the default guess time for this block"
      )}`,
	      readOnly: isRandom(guessTime) || isRandom(extraGuessTime)
	    });
	  }
	  if (overrides.samplePoint) {
	    const { samplePoint } = overrides.samplePoint;
	    chips.push({
	      key: "samplePoint",
	      // A percentage of the song, not seconds. AMQ has no song length to
	      // convert with.
	      label: `${formatMaybeRandom(samplePoint)}%`,
	      tooltip: `${t("quiz_builder.rule_labels.sample_point", "Sample Point")} — ${t(
        "quiz_builder.rule_labels.override_sample_point",
        "Override the default sample point for this block"
      )}`,
	      readOnly: isRandom(samplePoint)
	    });
	  }
	  if (overrides.playBackSpeed) {
	    const { playBackSpeed } = overrides.playBackSpeed;
	    chips.push({
	      key: "playBackSpeed",
	      label: Array.isArray(playBackSpeed) ? `${playBackSpeed.join("/")}×` : `${playBackSpeed}×`,
	      tooltip: `${t(
        "quiz_builder.rule_labels.playback_speed",
        "Playback Speed"
      )} — ${t(
        "quiz_builder.rule_labels.override_playback_speed",
        "Override the default playback speed for this block"
      )}`,
	      readOnly: Array.isArray(playBackSpeed)
	    });
	  }
	  if (overrides.guessModes) {
	    chips.push({
	      key: "guessModes",
	      label: guessModeNames(overrides.guessModes).join(" · ") || "—",
	      tooltip: t(
	        "quiz_builder.rule_labels.override_guess_mode",
	        "Override the default guess modes for this block"
	      ),
	      readOnly: false
	    });
	  }
	  return chips;
	}

	var root$v = from_html(`<p class="readonly svelte-19gxrb0"> <span class="why svelte-19gxrb0">You cannot edit a random range here. To edit it, run <code class="svelte-19gxrb0">__amqUI.quizBuilder.useLegacy()</code>. A save keeps it
              unchanged.</span></p>`);

	var root_1$r = from_html(`<div class="row svelte-19gxrb0"><label class="field svelte-19gxrb0"><span>Seconds</span> <input class="num svelte-19gxrb0" type="number" min="1" max="60"/></label> <label class="field svelte-19gxrb0"><span> </span> <input class="num svelte-19gxrb0" type="number" min="0" max="15"/></label></div>`);
	var root_2$l = from_html(`<p class="readonly svelte-19gxrb0"> <span class="why svelte-19gxrb0">A save keeps it unchanged. Edit it in AMQ's own builder.</span></p>`);
	var root_3$f = from_html(`<div class="row svelte-19gxrb0"><input class="rng svelte-19gxrb0" type="range" min="0" max="100" step="1"/> <span class="pct mono svelte-19gxrb0"> </span></div> <p class="note svelte-19gxrb0">Where in the song playback starts, as a percentage.</p>`, 1);
	var root_4$a = from_html(`<button type="button"> </button>`);
	var root_5$9 = from_html(`<div class="segmented svelte-19gxrb0"></div>`);
	var root_6$4 = from_html(`<div class="scrim svelte-19gxrb0" role="presentation"></div> <div class="panel svelte-19gxrb0" role="dialog" aria-label="Rule block settings"><header class="head svelte-19gxrb0"><h2 class="svelte-19gxrb0"> </h2> <button type="button" class="close svelte-19gxrb0" aria-label="Close"><!></button></header> <div class="body svelte-19gxrb0"><section class="svelte-19gxrb0"><h3 class="svelte-19gxrb0">Songs from this block</h3> <div class="row svelte-19gxrb0"><input class="rng svelte-19gxrb0" type="range" min="1" step="1"/> <input class="num svelte-19gxrb0" type="number" min="1" aria-label="Song count, typed"/></div> <p class="note svelte-19gxrb0"> </p></section> <section class="svelte-19gxrb0"><h3 class="svelte-19gxrb0"> </h3> <div class="segmented svelte-19gxrb0"><button type="button"> </button> <button type="button"> </button></div> <p class="note svelte-19gxrb0">Locked entries keep their position either way.</p></section> <section class="svelte-19gxrb0"><h3 class="svelte-19gxrb0"> </h3> <!></section> <section class="svelte-19gxrb0"><h3 class="svelte-19gxrb0"> </h3> <!></section> <section class="svelte-19gxrb0"><h3 class="svelte-19gxrb0"> </h3> <!></section> <section class="svelte-19gxrb0"><h3 class="svelte-19gxrb0">Guess mode</h3> <div class="segmented svelte-19gxrb0"></div> <p class="note svelte-19gxrb0">At least one is always on. Entries can override this.</p></section> <section class="svelte-19gxrb0"><h3 class="svelte-19gxrb0">Duplicates</h3> <label class="switch svelte-19gxrb0"><input type="checkbox" class="svelte-19gxrb0"/> </label></section></div></div>`, 1);

	const $$css$v = {
		hash: 'svelte-19gxrb0',
		code: '.scrim.svelte-19gxrb0 {position:fixed;inset:0;z-index:20;background:rgba(0, 0, 0, 0.45);}.panel.svelte-19gxrb0 {position:fixed;top:50%;left:50%;z-index:21;transform:translate(-50%, -50%);width:420px;max-height:80vh;display:flex;flex-direction:column;border-radius:10px;background:var(--bg-pop);border:1px solid var(--line-strong);box-shadow:0 18px 50px rgba(0, 0, 0, 0.5);}.head.svelte-19gxrb0 {flex:none;display:flex;align-items:center;height:46px;padding:0 14px;border-bottom:1px solid var(--line);}.head.svelte-19gxrb0 h2:where(.svelte-19gxrb0) {flex:1 1 0;margin:0;font-family:var(--font-display);font-size:14px;font-weight:700;}.close.svelte-19gxrb0 {display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-4);cursor:pointer;}.close.svelte-19gxrb0:hover {background:var(--bg-raised);color:var(--text);}.body.svelte-19gxrb0 {flex:1 1 auto;min-height:0;overflow-y:auto;padding:4px 14px 14px;}section.svelte-19gxrb0 {padding:12px 0;border-bottom:1px solid var(--line);}section.svelte-19gxrb0:last-child {border-bottom:0;}h3.svelte-19gxrb0 {margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-4);}.row.svelte-19gxrb0 {display:flex;align-items:center;gap:10px;}.rng.svelte-19gxrb0 {flex:1 1 0;accent-color:var(--accent);}.num.svelte-19gxrb0 {width:70px;height:28px;padding:0 8px;border-radius:7px;background:var(--bg-sunken);border:1px solid var(--line-strong);color:var(--text);font-family:var(--font-mono);font-size:12px;}.field.svelte-19gxrb0 {display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-3);}.pct.svelte-19gxrb0 {width:44px;text-align:right;font-size:12px;color:var(--text-2);}.segmented.svelte-19gxrb0 {display:flex;gap:4px;flex-wrap:wrap;}.segmented.svelte-19gxrb0 button:where(.svelte-19gxrb0) {height:28px;padding:0 11px;border-radius:7px;background:transparent;border:1px dashed var(--chip-off-line);color:var(--chip-off-fg);font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer;}.segmented.svelte-19gxrb0 button.on:where(.svelte-19gxrb0) {background:var(--chip-blue-bg);border:1px solid var(--chip-blue-line);color:var(--blue-fg);}.note.svelte-19gxrb0 {margin:8px 0 0;font-size:11px;color:var(--text-5);}.readonly.svelte-19gxrb0 {margin:0;font-size:12px;color:var(--amber-fg);}.why.svelte-19gxrb0 {display:block;margin-top:5px;font-size:10.5px;color:var(--text-5);}code.svelte-19gxrb0 {font-family:var(--font-mono);font-size:10.5px;}.switch.svelte-19gxrb0 {display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-2);cursor:pointer;}.switch.svelte-19gxrb0 input:where(.svelte-19gxrb0) {width:14px;height:14px;accent-color:var(--accent);}'
	};

	function BlockSettings($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$v);

		const block = user_derived(() => quizStore.quiz.blocks.find((entry) => entry.id === $$props.blockId));
		const position = user_derived(() => quizStore.quiz.blocks.findIndex((entry) => entry.id === $$props.blockId) + 1);
		const ceiling = user_derived(() => get(block) ? quizStore.ceiling(get(block)) : MAX_SONG_COUNT);
		const otherBlocks = user_derived(() => get(block) ? MAX_SONG_COUNT - get(ceiling) : 0);
		const guessTimeRandom = user_derived(() => Array.isArray(get(block)?.guessTime.guessTime) || Array.isArray(get(block)?.guessTime.extraGuessTime));
		const sampleRandom = user_derived(() => Array.isArray(get(block)?.samplePoint.samplePoint));
		const speedRandom = user_derived(() => Array.isArray(get(block)?.playBackSpeed.playBackSpeed));

		function setGuessTime(field, value) {
			if (!get(block) || get(guessTimeRandom)) return;

			quizStore.updateBlock($$props.blockId, { guessTime: { ...get(block).guessTime, [field]: value } });
		}

		function toggleMode(key) {
			if (!get(block)) return;

			quizStore.updateBlock($$props.blockId, {
				guessModes: QuizStore.toggleGuessMode(get(block).guessModes, key)
			});
		}

		var fragment = comment();
		var node = first_child(fragment);

		{
			var consequent_3 = ($$anchor) => {
				var fragment_1 = root_6$4();
				var div = first_child(fragment_1);
				var div_1 = sibling(div, 2);
				var header = child(div_1);
				var h2 = child(header);
				var text = only_child(h2);
				var button = sibling(h2, 2);
				var node_1 = child(button);

				Icon(node_1, { name: 'close', size: 14 });

				var div_2 = sibling(header, 2);
				var section = child(div_2);
				var div_3 = sibling(child(section), 2);
				var input = child(div_3);

				var input_1 = sibling(input, 2);

				var p = sibling(div_3, 2);
				var text_1 = only_child(p);

				var section_1 = sibling(section, 2);
				var h3 = child(section_1);
				var text_2 = only_child(h3, true);
				var div_4 = sibling(h3, 2);
				var button_1 = child(div_4);
				let classes;
				var text_3 = only_child(button_1, true);
				var button_2 = sibling(button_1, 2);
				let classes_1;
				var text_4 = only_child(button_2, true);

				var section_2 = sibling(section_1, 2);
				var h3_1 = child(section_2);
				var text_5 = only_child(h3_1, true);
				var node_2 = sibling(h3_1, 2);

				{
					var consequent = ($$anchor) => {
						var p_1 = root$v();
						var text_6 = child(p_1);

						template_effect(($0, $1) => set_text(text_6, `Random range: ${$0 ?? ''}s + ${$1 ?? ''}s `), [
							() => formatMaybeRandom(get(block).guessTime.guessTime),
							() => formatMaybeRandom(get(block).guessTime.extraGuessTime)
						]);

						append($$anchor, p_1);
					};

					var alternate = ($$anchor) => {
						var div_5 = root_1$r();
						var label = child(div_5);
						var input_2 = sibling(child(label), 2);

						var label_1 = sibling(label, 2);
						var span = child(label_1);
						var text_7 = only_child(span, true);
						var input_3 = sibling(span, 2);

						template_effect(
							($0) => {
								set_value(input_2, get(block).guessTime.guessTime);
								set_text(text_7, $0);
								set_value(input_3, get(block).guessTime.extraGuessTime);
							},
							[
								() => t('quiz_builder.rule_labels.extra_guess_time', 'Extra')
							]
						);

						delegated('input', input_2, (event) => setGuessTime('guessTime', Number(event.currentTarget.value)));
						delegated('input', input_3, (event) => setGuessTime('extraGuessTime', Number(event.currentTarget.value)));
						append($$anchor, div_5);
					};

					if_block(node_2, ($$render) => {
						if (get(guessTimeRandom)) $$render(consequent); else $$render(alternate, -1);
					});
				}

				var section_3 = sibling(section_2, 2);
				var h3_2 = child(section_3);
				var text_8 = only_child(h3_2, true);
				var node_3 = sibling(h3_2, 2);

				{
					var consequent_1 = ($$anchor) => {
						var p_2 = root_2$l();
						var text_9 = child(p_2);

						template_effect(($0) => set_text(text_9, `Random range: ${$0 ?? ''}% `), [
							() => formatMaybeRandom(get(block).samplePoint.samplePoint)
						]);

						append($$anchor, p_2);
					};

					var alternate_1 = ($$anchor) => {
						var fragment_2 = root_3$f();
						var div_6 = first_child(fragment_2);
						var input_4 = child(div_6);

						var span_1 = sibling(input_4, 2);
						var text_10 = only_child(span_1);

						template_effect(
							($0) => {
								set_value(input_4, get(block).samplePoint.samplePoint);
								set_attribute(input_4, 'aria-label', $0);
								set_text(text_10, `${get(block).samplePoint.samplePoint ?? ''}%`);
							},
							[
								() => t('quiz_builder.rule_block.popovers.sample_point_description', 'The default sample point for songs in this block')
							]
						);

						delegated('input', input_4, (event) => quizStore.updateBlock($$props.blockId, {
							samplePoint: { samplePoint: Number(event.currentTarget.value) }
						}));

						append($$anchor, fragment_2);
					};

					if_block(node_3, ($$render) => {
						if (get(sampleRandom)) $$render(consequent_1); else $$render(alternate_1, -1);
					});
				}

				var section_4 = sibling(section_3, 2);
				var h3_3 = child(section_4);
				var text_11 = only_child(h3_3, true);
				var node_4 = sibling(h3_3, 2);

				{
					var consequent_2 = ($$anchor) => {
						var p_3 = root_2$l();
						var text_12 = child(p_3);
						template_effect(($0) => set_text(text_12, `Random among ${$0 ?? ''}× `), [() => get(block).playBackSpeed.playBackSpeed.join(', ')]);
						append($$anchor, p_3);
					};

					var alternate_2 = ($$anchor) => {
						var div_7 = root_5$9();

						each(div_7, 20, () => PLAYBACK_SPEED_TICKS, (tick) => tick, ($$anchor, tick) => {
							var button_3 = root_4$a();
							let classes_2;
							var text_13 = only_child(button_3);

							template_effect(() => {
								classes_2 = set_class(button_3, 1, 'svelte-19gxrb0', null, classes_2, { on: get(block).playBackSpeed.playBackSpeed === tick });
								set_text(text_13, `${tick ?? ''}×`);
							});

							delegated('click', button_3, () => quizStore.updateBlock($$props.blockId, { playBackSpeed: { playBackSpeed: tick } }));
							append($$anchor, button_3);
						});
						append($$anchor, div_7);
					};

					if_block(node_4, ($$render) => {
						if (get(speedRandom)) $$render(consequent_2); else $$render(alternate_2, -1);
					});
				}

				var section_5 = sibling(section_4, 2);
				var div_8 = sibling(child(section_5), 2);

				each(
					div_8,
					20,
					() => [
						{
							key: 'song',
							i18n: 'quiz_builder.rule_block.guess_mode.song',
							fallback: 'Song'
						},

						{
							key: 'tinyVideo',
							i18n: 'quiz_builder.rule_block.guess_mode.tiny_video',
							fallback: 'Tiny Video'
						},

						{
							key: 'blurVideo',
							i18n: 'quiz_builder.rule_block.guess_mode.blur_video',
							fallback: 'Blur Video'
						}
					],
					(mode) => mode.key,
					($$anchor, mode) => {
						var button_4 = root_4$a();
						let classes_3;
						var text_14 = only_child(button_4, true);

						template_effect(
							($0) => {
								set_attribute(button_4, 'aria-pressed', get(block).guessModes[mode.key]);
								classes_3 = set_class(button_4, 1, 'svelte-19gxrb0', null, classes_3, { on: get(block).guessModes[mode.key] });
								set_text(text_14, $0);
							},
							[() => t(mode.i18n, mode.fallback)]
						);

						delegated('click', button_4, () => toggleMode(mode.key));
						append($$anchor, button_4);
					}
				);

				var section_6 = sibling(section_5, 2);
				var label_2 = sibling(child(section_6), 2);
				var input_5 = child(label_2);

				var text_15 = sibling(input_5);

				template_effect(
					($0, $1, $2, $3, $4, $5, $6, $7, $8) => {
						set_text(text, `${$0 ?? ''}
        ${get(position) ?? ''}`);

						set_attribute(input, 'max', get(ceiling));
						set_value(input, get(block).songCount);
						set_attribute(input, 'aria-label', $1);
						set_attribute(input_1, 'max', get(ceiling));
						set_value(input_1, get(block).songCount);

						set_text(text_1, `The quiz uses ${get(otherBlocks) + get(block).songCount} of ${MAX_SONG_COUNT} songs.
          This block can have up to ${get(ceiling) ?? ''}.`);

						set_text(text_2, $2);
						classes = set_class(button_1, 1, 'svelte-19gxrb0', null, classes, { on: get(block).randomOrder });
						set_text(text_3, $3);
						classes_1 = set_class(button_2, 1, 'svelte-19gxrb0', null, classes_1, { on: !get(block).randomOrder });
						set_text(text_4, $4);
						set_text(text_5, $5);
						set_text(text_8, $6);
						set_text(text_11, $7);
						set_checked(input_5, get(block).duplicates);
						set_text(text_15, ` ${$8 ?? ''}`);
					},
					[
						() => t('quiz_builder.rule_block.title', 'Rule Block'),
						() => t('quiz_builder.rule_block.song_count.description', 'Number of songs to select from this block'),
						() => t('quiz_builder.rule_block.order_rule.description', 'Order'),
						() => t('quiz_builder.rule_block.order_rule.random', 'Random'),
						() => t('quiz_builder.rule_block.order_rule.sequential', 'Sequential'),
						() => t('quiz_builder.rule_labels.guess_time', 'Guess Time'),
						() => t('quiz_builder.rule_labels.sample_point', 'Sample Point'),
						() => t('quiz_builder.rule_labels.playback_speed', 'Playback Speed'),
						() => t('quiz_builder.rule_block.popovers.allow_duplicates', 'Allow duplicate shows to be selected from this block')
					]
				);

				delegated('click', div, function (...$$args) {
					$$props.onClose?.apply(this, $$args);
				});

				delegated('click', button, function (...$$args) {
					$$props.onClose?.apply(this, $$args);
				});

				delegated('input', input, (event) => quizStore.setSongCount($$props.blockId, Number(event.currentTarget.value)));
				delegated('input', input_1, (event) => quizStore.setSongCount($$props.blockId, Number(event.currentTarget.value)));
				delegated('click', button_1, () => quizStore.updateBlock($$props.blockId, { randomOrder: true }));
				delegated('click', button_2, () => quizStore.updateBlock($$props.blockId, { randomOrder: false }));
				delegated('change', input_5, (event) => quizStore.updateBlock($$props.blockId, { duplicates: event.currentTarget.checked }));
				append($$anchor, fragment_1);
			};

			if_block(node, ($$render) => {
				if (get(block)) $$render(consequent_3);
			});
		}

		append($$anchor, fragment);
		pop();
	}

	delegate(['click', 'input', 'change']);

	var root$u = from_html(`<button type="button"> </button>`);
	var root_1$q = from_html(`<p class="readonly svelte-1nbwf8p"> <span class="why svelte-1nbwf8p">A save keeps it unchanged. To edit a random range, run <code class="svelte-1nbwf8p">__amqUI.quizBuilder.useLegacy()</code>.</span></p>`);
	var root_2$k = from_html(`<button type="button" class="unset svelte-1nbwf8p">Use block default</button>`);
	var root_3$e = from_html(`<div class="row svelte-1nbwf8p"><label class="field svelte-1nbwf8p"><span>Seconds</span> <input class="num svelte-1nbwf8p" type="number" min="1" max="60"/></label> <label class="field svelte-1nbwf8p"><span> </span> <input class="num svelte-1nbwf8p" type="number" min="0" max="15"/></label> <!></div>`);
	var root_4$9 = from_html(`<p class="readonly svelte-1nbwf8p"> <span class="why svelte-1nbwf8p">A save keeps it unchanged. Edit it in AMQ's own builder.</span></p>`);
	var root_5$8 = from_html(`<button type="button" class="unset svelte-1nbwf8p">Reset</button>`);
	var root_6$3 = from_html(`<div class="row svelte-1nbwf8p"><input class="rng svelte-1nbwf8p" type="range" min="0" max="100" step="1"/> <span class="pct mono svelte-1nbwf8p"> </span> <!></div>`);
	var root_7$1 = from_html(`<div class="segmented svelte-1nbwf8p"><!> <button type="button">Use block default</button></div>`);
	var root_8 = from_html(`<div class="scrim svelte-1nbwf8p" role="presentation"></div> <div class="panel svelte-1nbwf8p" role="dialog" aria-label="Entry settings"><header class="head svelte-1nbwf8p"><h2 class="svelte-1nbwf8p"> </h2> <button type="button" class="close svelte-1nbwf8p" aria-label="Close"><!></button></header> <div class="body svelte-1nbwf8p"><section class="svelte-1nbwf8p"><h3 class="svelte-1nbwf8p">Guess mode</h3> <div class="segmented svelte-1nbwf8p"><!> <button type="button">Use block default</button></div></section> <section class="svelte-1nbwf8p"><h3 class="svelte-1nbwf8p"> </h3> <!></section> <section class="svelte-1nbwf8p"><h3 class="svelte-1nbwf8p"> </h3> <!></section> <section class="svelte-1nbwf8p"><h3 class="svelte-1nbwf8p"> </h3> <!></section></div> <footer class="foot svelte-1nbwf8p"><button type="button" class="quiet svelte-1nbwf8p">Reset to block</button> <span class="spacer svelte-1nbwf8p"></span> <button type="button" class="done svelte-1nbwf8p"> </button></footer></div>`, 1);

	const $$css$u = {
		hash: 'svelte-1nbwf8p',
		code: '.scrim.svelte-1nbwf8p {position:fixed;inset:0;z-index:20;background:rgba(0, 0, 0, 0.45);}.panel.svelte-1nbwf8p {position:fixed;top:50%;left:50%;z-index:21;transform:translate(-50%, -50%);width:430px;max-height:80vh;display:flex;flex-direction:column;border-radius:10px;background:var(--bg-pop);border:1px solid var(--line-strong);box-shadow:0 18px 50px rgba(0, 0, 0, 0.5);}.head.svelte-1nbwf8p {flex:none;display:flex;align-items:center;height:46px;padding:0 14px;border-bottom:1px solid var(--line);}.head.svelte-1nbwf8p h2:where(.svelte-1nbwf8p) {flex:1 1 0;margin:0;font-family:var(--font-display);font-size:14px;font-weight:700;}.close.svelte-1nbwf8p {display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-4);cursor:pointer;}.body.svelte-1nbwf8p {flex:1 1 auto;min-height:0;overflow-y:auto;padding:4px 14px 10px;}section.svelte-1nbwf8p {padding:12px 0;border-bottom:1px solid var(--line);}section.svelte-1nbwf8p:last-child {border-bottom:0;}h3.svelte-1nbwf8p {margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-4);}.row.svelte-1nbwf8p {display:flex;align-items:center;gap:10px;}.rng.svelte-1nbwf8p {flex:1 1 0;accent-color:var(--amber);}.num.svelte-1nbwf8p {width:62px;height:27px;padding:0 8px;border-radius:7px;background:var(--bg-sunken);\n    /* Amber marks an override: the entry differs from its block. */border:1px solid var(--chip-amber-line);color:var(--amber-fg);font-family:var(--font-mono);font-size:11.5px;}.field.svelte-1nbwf8p {display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-3);}.pct.svelte-1nbwf8p {width:42px;text-align:right;font-size:12px;color:var(--amber-fg);}.segmented.svelte-1nbwf8p {display:flex;gap:4px;flex-wrap:wrap;}.segmented.svelte-1nbwf8p button:where(.svelte-1nbwf8p) {height:28px;padding:0 11px;border-radius:7px;background:transparent;border:1px dashed var(--chip-off-line);color:var(--chip-off-fg);font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer;}.segmented.svelte-1nbwf8p button.on:where(.svelte-1nbwf8p) {background:var(--chip-amber-bg);border:1px solid var(--chip-amber-line);color:var(--amber-fg);}\n\n  /* "Follows the block" is the neutral state, so it is not amber. */.segmented.svelte-1nbwf8p .default.on:where(.svelte-1nbwf8p) {background:var(--bg-raised);border:1px solid var(--line-strong);color:var(--text-2);}.unset.svelte-1nbwf8p {height:27px;padding:0 9px;border-radius:7px;background:transparent;border:1px solid var(--line-soft);color:var(--text-4);font-family:inherit;font-size:11px;cursor:pointer;}.unset.svelte-1nbwf8p:hover {color:var(--text-2);}.readonly.svelte-1nbwf8p {margin:0;font-size:12px;color:var(--amber-fg);}.why.svelte-1nbwf8p {display:block;margin-top:5px;font-size:10.5px;color:var(--text-5);}code.svelte-1nbwf8p {font-family:var(--font-mono);font-size:10.5px;}.foot.svelte-1nbwf8p {flex:none;display:flex;align-items:center;gap:8px;height:52px;padding:0 14px;border-top:1px solid var(--line);}.spacer.svelte-1nbwf8p {flex:1 1 0;}.quiet.svelte-1nbwf8p {height:29px;padding:0 10px;border-radius:7px;background:transparent;border:1px solid var(--line-soft);color:var(--text-3);font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer;}.done.svelte-1nbwf8p {height:29px;padding:0 12px;border-radius:7px;background:var(--chip-blue-bg);border:1px solid var(--chip-blue-line);color:var(--accent-soft);font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;}'
	};

	function EntrySettings($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$u);

		/** Only entries that play a song have overrides. */
		const targets = user_derived(() => {
			const out = [];

			for (const block of quizStore.quiz.blocks) {
				for (const entry of block.entries) {
					if ($$props.ids.includes(entry.id) && isPlayEntry(entry)) out.push(entry);
				}
			}

			return out;
		});

		/** The panel shows the first target's values and applies edits to all. */
		const lead = user_derived(() => get(targets)[0]);

		const multiple = user_derived(() => get(targets).length > 1);
		const guessTime = user_derived(() => get(lead)?.overrides.guessTime);
		const samplePoint = user_derived(() => get(lead)?.overrides.samplePoint);
		const speed = user_derived(() => get(lead)?.overrides.playBackSpeed);
		const modes = user_derived(() => get(lead)?.overrides.guessModes);
		const guessTimeRandom = user_derived(() => Array.isArray(get(guessTime)?.guessTime) || Array.isArray(get(guessTime)?.extraGuessTime));
		const sampleRandom = user_derived(() => Array.isArray(get(samplePoint)?.samplePoint));
		const speedRandom = user_derived(() => Array.isArray(get(speed)?.playBackSpeed));

		function apply(key, value) {
			quizStore.setOverride($$props.ids, key, value);
		}

		function clear(key) {
			quizStore.clearOverride($$props.ids, key);
		}

		function toggleMode(key) {
			const current = get(modes) ?? { song: true, tinyVideo: false, blurVideo: false };

			apply('guessModes', QuizStore.toggleGuessMode(current, key));
		}

		var fragment = comment();
		var node = first_child(fragment);

		{
			var consequent_5 = ($$anchor) => {
				var fragment_1 = root_8();
				var div = first_child(fragment_1);
				var div_1 = sibling(div, 2);
				var header = child(div_1);
				var h2 = child(header);
				var text = only_child(h2, true);
				var button = sibling(h2, 2);
				var node_1 = child(button);

				Icon(node_1, { name: 'close', size: 14 });

				var div_2 = sibling(header, 2);
				var section = child(div_2);
				var div_3 = sibling(child(section), 2);
				var node_2 = child(div_3);

				each(
					node_2,
					16,
					() => [
						{
							key: 'song',
							i18n: 'quiz_builder.rule_block.guess_mode.song',
							fallback: 'Song'
						},

						{
							key: 'tinyVideo',
							i18n: 'quiz_builder.rule_block.guess_mode.tiny_video',
							fallback: 'Tiny Video'
						},

						{
							key: 'blurVideo',
							i18n: 'quiz_builder.rule_block.guess_mode.blur_video',
							fallback: 'Blur Video'
						}
					],
					(mode) => mode.key,
					($$anchor, mode) => {
						var button_1 = root$u();
						let classes;
						var text_1 = only_child(button_1, true);

						template_effect(
							($0, $1) => {
								set_attribute(button_1, 'aria-pressed', $0);
								classes = set_class(button_1, 1, 'svelte-1nbwf8p', null, classes, { on: get(modes)?.[mode.key] });
								set_text(text_1, $1);
							},
							[
								() => Boolean(get(modes)?.[mode.key]),
								() => t(mode.i18n, mode.fallback)
							]
						);

						delegated('click', button_1, () => toggleMode(mode.key));
						append($$anchor, button_1);
					}
				);

				var button_2 = sibling(node_2, 2);
				let classes_1;

				var section_1 = sibling(section, 2);
				var h3 = child(section_1);
				var text_2 = only_child(h3, true);
				var node_3 = sibling(h3, 2);

				{
					var consequent = ($$anchor) => {
						var p = root_1$q();
						var text_3 = child(p);

						template_effect(($0, $1) => set_text(text_3, `Random range: ${$0 ?? ''}s + ${$1 ?? ''}s `), [
							() => formatMaybeRandom(get(guessTime).guessTime),
							() => formatMaybeRandom(get(guessTime).extraGuessTime)
						]);

						append($$anchor, p);
					};

					var alternate = ($$anchor) => {
						var div_4 = root_3$e();
						var label = child(div_4);
						var input = sibling(child(label), 2);

						var label_1 = sibling(label, 2);
						var span = child(label_1);
						var text_4 = only_child(span, true);
						var input_1 = sibling(span, 2);

						var node_4 = sibling(label_1, 2);

						{
							var consequent_1 = ($$anchor) => {
								var button_3 = root_2$k();

								delegated('click', button_3, () => clear('guessTime'));
								append($$anchor, button_3);
							};

							if_block(node_4, ($$render) => {
								if (get(guessTime)) $$render(consequent_1);
							});
						}

						template_effect(
							($0) => {
								set_value(input, get(guessTime)?.guessTime ?? 20);
								set_text(text_4, $0);
								set_value(input_1, get(guessTime)?.extraGuessTime ?? 0);
							},
							[
								() => t('quiz_builder.rule_labels.extra_guess_time', 'Extra')
							]
						);

						delegated('input', input, (event) => apply('guessTime', {
							guessTime: Number(event.currentTarget.value),
							extraGuessTime: get(guessTime)?.extraGuessTime ?? 0
						}));

						delegated('input', input_1, (event) => apply('guessTime', {
							guessTime: get(guessTime)?.guessTime ?? 20,
							extraGuessTime: Number(event.currentTarget.value)
						}));

						append($$anchor, div_4);
					};

					if_block(node_3, ($$render) => {
						if (get(guessTimeRandom)) $$render(consequent); else $$render(alternate, -1);
					});
				}

				var section_2 = sibling(section_1, 2);
				var h3_1 = child(section_2);
				var text_5 = only_child(h3_1, true);
				var node_5 = sibling(h3_1, 2);

				{
					var consequent_2 = ($$anchor) => {
						var p_1 = root_4$9();
						var text_6 = child(p_1);
						template_effect(($0) => set_text(text_6, `Random range: ${$0 ?? ''}% `), [() => formatMaybeRandom(get(samplePoint).samplePoint)]);
						append($$anchor, p_1);
					};

					var alternate_1 = ($$anchor) => {
						var div_5 = root_6$3();
						var input_2 = child(div_5);

						var span_1 = sibling(input_2, 2);
						var text_7 = only_child(span_1);
						var node_6 = sibling(span_1, 2);

						{
							var consequent_3 = ($$anchor) => {
								var button_4 = root_5$8();

								delegated('click', button_4, () => clear('samplePoint'));
								append($$anchor, button_4);
							};

							if_block(node_6, ($$render) => {
								if (get(samplePoint)) $$render(consequent_3);
							});
						}

						template_effect(
							($0) => {
								set_value(input_2, get(samplePoint)?.samplePoint ?? 50);
								set_attribute(input_2, 'aria-label', $0);
								set_text(text_7, `${get(samplePoint)?.samplePoint ?? 50 ?? ''}%`);
							},
							[
								() => t('quiz_builder.rule_labels.override_sample_point', 'Override the default sample point for this block')
							]
						);

						delegated('input', input_2, (event) => apply('samplePoint', { samplePoint: Number(event.currentTarget.value) }));
						append($$anchor, div_5);
					};

					if_block(node_5, ($$render) => {
						if (get(sampleRandom)) $$render(consequent_2); else $$render(alternate_1, -1);
					});
				}

				var section_3 = sibling(section_2, 2);
				var h3_2 = child(section_3);
				var text_8 = only_child(h3_2, true);
				var node_7 = sibling(h3_2, 2);

				{
					var consequent_4 = ($$anchor) => {
						var p_2 = root_4$9();
						var text_9 = child(p_2);
						template_effect(($0) => set_text(text_9, `Random among ${$0 ?? ''}× `), [() => get(speed).playBackSpeed.join(', ')]);
						append($$anchor, p_2);
					};

					var alternate_2 = ($$anchor) => {
						var div_6 = root_7$1();
						var node_8 = child(div_6);

						each(node_8, 16, () => PLAYBACK_SPEED_TICKS, (tick) => tick, ($$anchor, tick) => {
							var button_5 = root$u();
							let classes_2;
							var text_10 = only_child(button_5);

							template_effect(() => {
								classes_2 = set_class(button_5, 1, 'svelte-1nbwf8p', null, classes_2, { on: get(speed)?.playBackSpeed === tick });
								set_text(text_10, `${tick ?? ''}×`);
							});

							delegated('click', button_5, () => apply('playBackSpeed', { playBackSpeed: tick }));
							append($$anchor, button_5);
						});

						var button_6 = sibling(node_8, 2);
						let classes_3;
						template_effect(() => classes_3 = set_class(button_6, 1, 'default svelte-1nbwf8p', null, classes_3, { on: !get(speed) }));
						delegated('click', button_6, () => clear('playBackSpeed'));
						append($$anchor, div_6);
					};

					if_block(node_7, ($$render) => {
						if (get(speedRandom)) $$render(consequent_4); else $$render(alternate_2, -1);
					});
				}

				var footer = sibling(div_2, 2);
				var button_7 = child(footer);
				var button_8 = sibling(button_7, 4);
				var text_11 = only_child(button_8, true);

				template_effect(
					($0, $1, $2) => {
						set_text(text, get(multiple) ? `${get(targets).length} entries` : 'Entry settings');
						classes_1 = set_class(button_2, 1, 'default svelte-1nbwf8p', null, classes_1, { on: !get(modes) });
						set_text(text_2, $0);
						set_text(text_5, $1);
						set_text(text_8, $2);

						set_text(text_11, get(multiple)
							? `Applied to ${get(targets).length} selected`
							: 'Done');
					},
					[
						() => t('quiz_builder.rule_labels.guess_time', 'Guess Time'),
						() => t('quiz_builder.rule_labels.sample_point', 'Sample Point'),
						() => t('quiz_builder.rule_labels.playback_speed', 'Playback Speed')
					]
				);

				delegated('click', div, function (...$$args) {
					$$props.onClose?.apply(this, $$args);
				});

				delegated('click', button, function (...$$args) {
					$$props.onClose?.apply(this, $$args);
				});

				delegated('click', button_2, () => clear('guessModes'));
				delegated('click', button_7, () => clear());

				delegated('click', button_8, function (...$$args) {
					$$props.onClose?.apply(this, $$args);
				});

				append($$anchor, fragment_1);
			};

			if_block(node, ($$render) => {
				if (get(lead)) $$render(consequent_5);
			});
		}

		append($$anchor, fragment);
		pop();
	}

	delegate(['click', 'input']);

	var root$t = from_html(`<button type="button"><!> </button>`);

	const $$css$t = {
		hash: 'svelte-wwm573',
		code: '.chip.svelte-wwm573 {display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px;border-radius:7px;background:rgba(255, 255, 255, 0.035);border:1px dashed rgba(255, 255, 255, 0.17);color:var(--chip-off-fg);font-size:12px;font-weight:500;cursor:pointer;}.chip.svelte-wwm573:hover {border-color:rgba(255, 255, 255, 0.3);color:var(--text-2);}.chip.on.svelte-wwm573 {background:rgba(91, 155, 245, 0.2);border:1px solid rgba(91, 155, 245, 0.48);color:var(--accent-soft);font-weight:600;}.chip.on.svelte-wwm573:hover {background:rgba(91, 155, 245, 0.28);}'
	};

	function ToggleChip($$anchor, $$props) {
		append_styles$1($$anchor, $$css$t);

		var button = root$t();
		let classes;
		var node = child(button);

		{
			var consequent = ($$anchor) => {
				Icon($$anchor, { name: 'check', size: 10, strokeWidth: 3.4 });
			};

			if_block(node, ($$render) => {
				if ($$props.on) $$render(consequent);
			});
		}

		var text = sibling(node);

		template_effect(() => {
			classes = set_class(button, 1, 'chip svelte-wwm573', null, classes, { on: $$props.on });
			set_attribute(button, 'aria-pressed', $$props.on);
			set_text(text, ` ${$$props.label ?? ''}`);
		});

		delegated('click', button, function (...$$args) {
			$$props.onToggle?.apply(this, $$args);
		});

		append($$anchor, button);
	}

	delegate(['click']);

	var root$s = from_html(`<span class="badge svelte-1hnt4ru"> </span> <button type="button" class="reset-all svelte-1hnt4ru">Reset all</button>`, 1);
	var root_1$p = from_html(`<button type="button" class="reset svelte-1hnt4ru"><span class="dot svelte-1hnt4ru"></span> Reset</button>`);
	var root_2$j = from_html(`<div class="group svelte-1hnt4ru"><div class="group-head svelte-1hnt4ru"><span class="group-title svelte-1hnt4ru"> </span> <span class="rule svelte-1hnt4ru"></span> <!></div> <div class="chips svelte-1hnt4ru"></div></div>`);
	var root_3$d = from_html(`<div class="group svelte-1hnt4ru"><div class="group-head svelte-1hnt4ru"><span class="group-title svelte-1hnt4ru"> </span> <span class="rule svelte-1hnt4ru"></span> <!></div> <div class="track-host svelte-1hnt4ru"><span class="track svelte-1hnt4ru"></span> <span class="fill svelte-1hnt4ru"></span> <input class="rng svelte-1hnt4ru" type="range" aria-label="Earliest year"/> <input class="rng svelte-1hnt4ru" type="range" aria-label="Latest year"/></div> <div class="bounds svelte-1hnt4ru"><input class="num svelte-1hnt4ru" type="number" aria-label="Earliest year, typed"/> <span class="dash svelte-1hnt4ru">–</span> <input class="num svelte-1hnt4ru" type="number" aria-label="Latest year, typed"/></div></div>`);
	var root_4$8 = from_html(`<div class="col svelte-1hnt4ru"><!> <!></div>`);

	var root_5$7 = from_html(`<div class="panel svelte-1hnt4ru"><header class="head svelte-1hnt4ru"><h2 class="svelte-1hnt4ru">Filters</h2> <!> <button type="button" class="close svelte-1hnt4ru" aria-label="Close"><!></button></header> <div class="cols svelte-1hnt4ru"></div> <p class="absent svelte-1hnt4ru">You cannot filter by difficulty, genres or tags here. Use an algorithm
      block for those filters.</p></div>`);

	const $$css$s = {
		hash: 'svelte-1hnt4ru',
		code: '.panel.svelte-1hnt4ru {padding:12px 14px 10px;}.head.svelte-1hnt4ru {display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid var(--line);}.head.svelte-1hnt4ru h2:where(.svelte-1hnt4ru) {margin:0;font-family:var(--font-display);font-size:13px;font-weight:700;}.badge.svelte-1hnt4ru {min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--accent);color:var(--accent-fg);font-size:9.5px;font-weight:700;line-height:16px;text-align:center;}.reset-all.svelte-1hnt4ru {margin-left:auto;height:24px;padding:0 9px;border-radius:6px;background:transparent;border:1px solid var(--line-soft);color:var(--text-3);font-family:inherit;font-size:11px;cursor:pointer;}.close.svelte-1hnt4ru {display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-4);cursor:pointer;}.close.svelte-1hnt4ru:hover {background:var(--bg-raised);color:var(--text);}.cols.svelte-1hnt4ru {display:flex;gap:22px;padding-top:10px;}.col.svelte-1hnt4ru {flex:1 1 0;min-width:0;}.group.svelte-1hnt4ru {padding:8px 0;}.group-head.svelte-1hnt4ru {display:flex;align-items:center;gap:8px;margin-bottom:7px;}.group-title.svelte-1hnt4ru {font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-4);white-space:nowrap;}.rule.svelte-1hnt4ru {flex:1 1 0;height:1px;background:var(--line);}.reset.svelte-1hnt4ru {display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 7px;border:0;border-radius:5px;background:transparent;color:var(--text-3);font-family:inherit;font-size:10.5px;cursor:pointer;}.dot.svelte-1hnt4ru {width:5px;height:5px;border-radius:50%;background:var(--accent);}.chips.svelte-1hnt4ru {display:flex;flex-wrap:wrap;gap:5px;}.track-host.svelte-1hnt4ru {position:relative;height:16px;margin:6px 0 4px;}.track.svelte-1hnt4ru,\n  .fill.svelte-1hnt4ru {position:absolute;top:6px;height:4px;border-radius:2px;}.track.svelte-1hnt4ru {left:0;width:100%;background:var(--bg-sunken);}.fill.svelte-1hnt4ru {background:var(--accent);}\n\n  /*\n   * Both inputs overlay one track. They have `pointer-events: none` and only\n   * the thumbs accept the pointer, so a click on the track cannot move the\n   * wrong handle.\n   */.rng.svelte-1hnt4ru {position:absolute;top:0;left:0;width:100%;height:16px;margin:0;background:transparent;appearance:none;pointer-events:none;}.rng.svelte-1hnt4ru::-webkit-slider-thumb {appearance:none;width:12px;height:12px;border:2px solid var(--bg-pop);border-radius:50%;background:var(--accent-soft);cursor:pointer;pointer-events:auto;}.rng.svelte-1hnt4ru::-moz-range-thumb {width:12px;height:12px;border:2px solid var(--bg-pop);border-radius:50%;background:var(--accent-soft);cursor:pointer;pointer-events:auto;}.bounds.svelte-1hnt4ru {display:flex;align-items:center;gap:8px;}.num.svelte-1hnt4ru {width:72px;height:26px;padding:0 8px;border-radius:6px;background:var(--bg-sunken);border:1px solid var(--line-strong);color:var(--text);font-family:var(--font-mono);font-size:11.5px;}.dash.svelte-1hnt4ru {color:var(--text-5);}.absent.svelte-1hnt4ru {margin:10px 0 0;padding-top:9px;border-top:1px solid var(--line);font-size:10.5px;color:var(--text-5);}'
	};

	function FilterPanel$1($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$s);

		const left = TOGGLE_GROUPS$1.slice(0, 3);
		const right = TOGGLE_GROUPS$1.slice(3);
		const vintage = user_derived(() => libraryFilters.state.vintage);
		const span = YEAR_MAX - YEAR_MIN;
		const lowPct = user_derived(() => (get(vintage)[0] - YEAR_MIN) / span * 100);
		const highPct = user_derived(() => (get(vintage)[1] - YEAR_MIN) / span * 100);

		Floating($$anchor, {
			get anchor() {
				return $$props.anchor;
			},
			placement: 'below',
			align: 'start',
			width: 680,
			maxWidth: 680,
			get onDismiss() {
				return $$props.onDismiss;
			},

			children: ($$anchor, $$slotProps) => {
				var div = root_5$7();
				var header = child(div);
				var node = sibling(child(header), 2);

				{
					var consequent = ($$anchor) => {
						var fragment_1 = root$s();
						var span_1 = first_child(fragment_1);
						var text = only_child(span_1, true);
						var button = sibling(span_1, 2);

						template_effect(() => set_text(text, libraryFilters.changedCount));
						delegated('click', button, () => libraryFilters.resetAll());
						append($$anchor, fragment_1);
					};

					if_block(node, ($$render) => {
						if (libraryFilters.changedCount > 0) $$render(consequent);
					});
				}

				var button_1 = sibling(node, 2);
				var node_1 = child(button_1);

				Icon(node_1, { name: 'close', size: 13 });

				var div_1 = sibling(header, 2);

				each(div_1, 21, () => [left, right], index, ($$anchor, column, columnIndex) => {
					var div_2 = root_4$8();
					var node_2 = child(div_2);

					each(node_2, 17, () => get(column), (group) => group.key, ($$anchor, group) => {
						var div_3 = root_2$j();
						var div_4 = child(div_3);
						var span_2 = child(div_4);
						var text_1 = only_child(span_2, true);
						var node_3 = sibling(span_2, 4);

						{
							var consequent_1 = ($$anchor) => {
								var button_2 = root_1$p();

								delegated('click', button_2, () => libraryFilters.resetGroup(get(group).key));
								append($$anchor, button_2);
							};

							var d = user_derived(() => libraryFilters.groupChanged(get(group).key));

							if_block(node_3, ($$render) => {
								if (get(d)) $$render(consequent_1);
							});
						}

						var div_5 = sibling(div_4, 2);

						each(div_5, 21, () => get(group).options, (option) => option.key, ($$anchor, option) => {
							{
								let $0 = user_derived(() => get(option).label());
								let $1 = user_derived(() => libraryFilters.toggles(get(group).key)[get(option).key]);

								ToggleChip($$anchor, {
									get label() {
										return get($0);
									},

									get on() {
										return get($1);
									},
									onToggle: () => libraryFilters.toggle(get(group).key, get(option).key)
								});
							}
						});
						template_effect(($0) => set_text(text_1, $0), [() => get(group).label()]);
						append($$anchor, div_3);
					});

					var node_4 = sibling(node_2, 2);

					{
						var consequent_3 = ($$anchor) => {
							var div_6 = root_3$d();
							var div_7 = child(div_6);
							var span_3 = child(div_7);
							var text_2 = only_child(span_3, true);
							var node_5 = sibling(span_3, 4);

							{
								var consequent_2 = ($$anchor) => {
									var button_3 = root_1$p();

									delegated('click', button_3, () => libraryFilters.resetVintage());
									append($$anchor, button_3);
								};

								if_block(node_5, ($$render) => {
									if (libraryFilters.vintageChanged) $$render(consequent_2);
								});
							}

							var div_8 = sibling(div_7, 2);
							var span_4 = sibling(child(div_8), 2);
							let styles;
							var input = sibling(span_4, 2);

							var input_1 = sibling(input, 2);

							var div_9 = sibling(div_8, 2);
							var input_2 = child(div_9);

							var input_3 = sibling(input_2, 4);

							template_effect(
								($0) => {
									set_text(text_2, $0);

									styles = set_style(span_4, '', styles, {
										left: `${get(lowPct) ?? ''}%`,
										width: `${get(highPct) - get(lowPct)}%`
									});

									set_attribute(input, 'min', YEAR_MIN);
									set_attribute(input, 'max', YEAR_MAX);
									set_value(input, get(vintage)[0]);
									set_attribute(input_1, 'min', YEAR_MIN);
									set_attribute(input_1, 'max', YEAR_MAX);
									set_value(input_1, get(vintage)[1]);
									set_attribute(input_2, 'min', YEAR_MIN);
									set_attribute(input_2, 'max', YEAR_MAX);
									set_value(input_2, get(vintage)[0]);
									set_attribute(input_3, 'min', YEAR_MIN);
									set_attribute(input_3, 'max', YEAR_MAX);
									set_value(input_3, get(vintage)[1]);
								},
								[() => t('room_browser.filters.vintage', 'Vintage')]
							);

							delegated('input', input, (event) => libraryFilters.setVintage(0, Number(event.currentTarget.value)));
							delegated('input', input_1, (event) => libraryFilters.setVintage(1, Number(event.currentTarget.value)));
							delegated('input', input_2, (event) => libraryFilters.setVintage(0, Number(event.currentTarget.value)));
							delegated('input', input_3, (event) => libraryFilters.setVintage(1, Number(event.currentTarget.value)));
							append($$anchor, div_6);
						};

						if_block(node_4, ($$render) => {
							if (columnIndex === 1) $$render(consequent_3);
						});
					}
					append($$anchor, div_2);
				});

				delegated('click', button_1, function (...$$args) {
					$$props.onDismiss?.apply(this, $$args);
				});

				append($$anchor, div);
			},
			$$slots: { default: true }
		});

		pop();
	}

	delegate(['click', 'input']);

	var root$r = from_html(`<span class="lead svelte-q4tu2z"><button type="button"><!></button></span> <span class="text svelte-q4tu2z"><span class="name svelte-q4tu2z"> </span> <span class="sub svelte-q4tu2z"> </span></span> <span class="count mono svelte-q4tu2z"> </span>`, 1);
	var root_1$o = from_html(`<span class="lead song-lead svelte-q4tu2z"><span class="badge svelte-q4tu2z"> </span></span> <span class="text svelte-q4tu2z"><span class="name svelte-q4tu2z"> </span> <span class="sub svelte-q4tu2z"> </span></span> <span class="count svelte-q4tu2z"></span>`, 1);
	var root_2$i = from_html(`<div role="presentation"><!> <span class="add-cell svelte-q4tu2z"><button type="button"><!> Add</button> <button type="button" class="add-chev svelte-q4tu2z" aria-label="Add to a specific block" title="Add to a specific block"><!></button></span></div>`);

	const $$css$r = {
		hash: 'svelte-q4tu2z',
		code: '.lib-row.svelte-q4tu2z {display:flex;align-items:center;gap:10px;height:var(--qb-lib-anime-h);padding:0 14px;border-bottom:1px solid var(--line);cursor:pointer;}.lib-row.song.svelte-q4tu2z {height:var(--qb-lib-song-h);\n    /* A song row has nothing to expand. */cursor:default;}.lib-row.svelte-q4tu2z:hover {background:var(--bg-row-hover);}\n\n  /* The tint groups an expanded anime with its songs. */.lib-row.open.svelte-q4tu2z {background:rgba(91, 155, 245, 0.08);}.lead.svelte-q4tu2z {flex:0 0 var(--qb-lib-lead);display:flex;align-items:center;justify-content:center;}.song-lead.svelte-q4tu2z {flex:0 0 var(--qb-lib-song-lead);}\n\n  /* Centred in its cell. Do not shift it to align with the type badges\n     below: it then looks off-centre in its own row. */.chev.svelte-q4tu2z {display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-3);cursor:pointer;transform:rotate(-90deg);}.chev.open.svelte-q4tu2z {transform:rotate(0deg);color:var(--blue-fg);}.badge.svelte-q4tu2z {display:inline-flex;align-items:center;height:23px;padding:0 9px;border-radius:5px;background:var(--chip-teal-bg);border:1px solid var(--chip-teal-line);color:var(--teal-fg);font-family:var(--font-mono);font-size:var(--qb-badge);font-weight:600;}.text.svelte-q4tu2z {flex:1 1 0;min-width:0;display:flex;flex-direction:column;justify-content:center;line-height:1.2;}.name.svelte-q4tu2z,\n  .sub.svelte-q4tu2z {white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.name.svelte-q4tu2z {font-size:15px;font-weight:600;color:var(--text);}.lib-row.song.svelte-q4tu2z .name:where(.svelte-q4tu2z) {font-size:var(--qb-text);font-weight:500;color:var(--text-2);}.sub.svelte-q4tu2z {font-size:var(--qb-text-xs);color:var(--text-4);}.count.svelte-q4tu2z {flex:0 0 var(--qb-lib-count);text-align:right;font-size:var(--qb-text-sm);color:var(--text-3);}.add-cell.svelte-q4tu2z {flex:0 0 var(--qb-lib-action);display:flex;align-items:center;justify-content:flex-end;gap:3px;}.add.svelte-q4tu2z {display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:7px;background:var(--bg-raised);border:1px solid var(--line-soft);color:var(--text-2);font-size:var(--qb-text-sm);font-weight:600;white-space:nowrap;cursor:pointer;}.add.svelte-q4tu2z:hover {border-color:var(--line-strong);color:var(--text);}.add.loud.svelte-q4tu2z {background:var(--accent);border-color:transparent;color:var(--accent-fg);font-weight:700;}.add-chev.svelte-q4tu2z {display:inline-flex;align-items:center;justify-content:center;width:24px;height:30px;padding:0;border:1px solid var(--line-soft);border-radius:7px;background:var(--bg-raised);color:var(--text-4);cursor:pointer;}.add-chev.svelte-q4tu2z:hover {color:var(--text);border-color:var(--line-strong);}'
	};

	function LibraryRow($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$r);

		let addChevron = state(null);

		/**
		 * The whole anime row toggles, not only the 24px chevron.
		 *
		 * Clicks on any `<button>` in the row are ignored here. That covers
		 * `+ Add`, the add-to-block caret and the chevron, whose own handler does
		 * the toggle.
		 */
		function onRowClick(event) {
			if ($$props.row.kind !== 'anime') return;
			if (event.target?.closest('button')) return;

			$$props.onToggle();
		}

		var div = root_2$i();
		let classes;
		var node = child(div);

		{
			var consequent = ($$anchor) => {
				var fragment = root$r();
				var span = first_child(fragment);
				var button = child(span);
				let classes_1;
				var node_1 = child(button);

				Icon(node_1, { name: 'caret', size: 15 });

				var span_1 = sibling(span, 2);
				var span_2 = child(span_1);
				var text = only_child(span_2, true);
				var span_3 = sibling(span_2, 2);
				var text_1 = only_child(span_3, true);

				var span_4 = sibling(span_1, 2);
				var text_2 = only_child(span_4, true);

				template_effect(() => {
					classes_1 = set_class(button, 1, 'chev svelte-q4tu2z', null, classes_1, { open: $$props.expanded });
					set_attribute(button, 'aria-expanded', $$props.expanded);

					set_attribute(button, 'aria-label', $$props.expanded
						? `Collapse ${$$props.row.name}`
						: `Expand ${$$props.row.name}`);

					set_attribute(span_2, 'title', $$props.row.name);
					set_text(text, $$props.row.name);
					set_text(text_1, $$props.row.sub);
					set_text(text_2, $$props.row.songCount);
				});

				delegated('click', button, function (...$$args) {
					$$props.onToggle?.apply(this, $$args);
				});

				append($$anchor, fragment);
			};

			var alternate = ($$anchor) => {
				var fragment_1 = root_1$o();
				var span_5 = first_child(fragment_1);
				var span_6 = child(span_5);
				var text_3 = only_child(span_6, true);

				var span_7 = sibling(span_5, 2);
				var span_8 = child(span_7);
				var text_4 = only_child(span_8, true);
				var span_9 = sibling(span_8, 2);
				var text_5 = only_child(span_9, true);

				template_effect(() => {
					set_text(text_3, $$props.row.badge);
					set_attribute(span_8, 'title', $$props.row.title);
					set_text(text_4, $$props.row.title);

					set_text(text_5, $$props.row.animeName
						? `${$$props.row.artist} · ${$$props.row.animeName}`
						: $$props.row.artist);
				});

				append($$anchor, fragment_1);
			};

			if_block(node, ($$render) => {
				if ($$props.row.kind === 'anime') $$render(consequent); else $$render(alternate, -1);
			});
		}

		var span_10 = sibling(node, 2);
		var button_1 = child(span_10);
		let classes_2;
		var node_2 = child(button_1);

		Icon(node_2, { name: 'plus', size: 13 });

		var button_2 = sibling(button_1, 2);
		var node_3 = child(button_2);

		Icon(node_3, { name: 'caret', size: 13 });
		bind_this(button_2, ($$value) => set(addChevron, $$value), () => get(addChevron));

		template_effect(() => {
			classes = set_class(div, 1, 'lib-row svelte-q4tu2z', null, classes, { song: $$props.row.kind === 'song', open: $$props.expanded });
			classes_2 = set_class(button_1, 1, 'add svelte-q4tu2z', null, classes_2, { loud: $$props.expanded });
		});

		delegated('click', div, onRowClick);

		delegated('click', button_1, function (...$$args) {
			$$props.onAdd?.apply(this, $$args);
		});

		delegated('click', button_2, () => get(addChevron) && $$props.onAddTo(get(addChevron)));
		append($$anchor, div);
		pop();
	}

	delegate(['click']);

	var root$q = from_html(`<button type="button" role="tab"> </button>`);
	var root_1$n = from_html(`<button type="button"> </button>`);
	var root_2$h = from_html(`<span class="badge svelte-iywwdf"> </span>`);

	var root_3$c = from_html(
		`The song library could not be read. <span class="hint svelte-iywwdf">Run <code class="svelte-iywwdf">__amqUI.quizBuilder.useLegacy()</code> to use AMQ's own builder,
            and report this problem.</span>`,
		1
	);

	var root_4$7 = from_html(`The song library did not load, so anime and song names cannot be shown. <span class="hint svelte-iywwdf">Reload the page, or run <code class="svelte-iywwdf">__amqUI.quizBuilder.useLegacy()</code> to use AMQ's own builder.</span>`, 1);
	var root_5$6 = from_html(`<p class="empty svelte-iywwdf"><!></p>`);
	var root_6$2 = from_html(`<p class="capped svelte-iywwdf"> </p>`);
	var root_7 = from_html(`<section class="pane svelte-iywwdf"><header class="band svelte-iywwdf"><h2 class="title svelte-iywwdf"> </h2> <div class="tabs svelte-iywwdf" role="tablist"></div> <span class="totals mono svelte-iywwdf"> </span></header> <div class="band filters svelte-iywwdf"><label class="search svelte-iywwdf"><!> <input id="amq-ui-library-search" type="search" placeholder="Search anime, songs, artists" class="svelte-iywwdf"/></label> <!> <button type="button" class="filter-btn svelte-iywwdf" aria-label="Filters" title="Filters"><!> <!></button></div> <div class="adds-to svelte-iywwdf"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="6.5" stroke="currentColor" stroke-width="2"></circle><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg> <span class="adds-label svelte-iywwdf">Adds to</span> <button type="button" class="target svelte-iywwdf"><span aria-hidden="true"></span> <!></button> <span class="drag-hint svelte-iywwdf">or drag across</span></div> <div class="columns svelte-iywwdf"><span class="col-text svelte-iywwdf">Anime · song</span> <span class="col-count svelte-iywwdf">Songs</span> <span class="col-action svelte-iywwdf"></span></div> <div class="list svelte-iywwdf"><!> <!></div></section>`);

	const $$css$q = {
		hash: 'svelte-iywwdf',
		code: '.pane.svelte-iywwdf {flex:1 1 38%;min-width:0;display:flex;flex-direction:column;background:var(--bg-list);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;}.band.svelte-iywwdf {flex:none;display:flex;align-items:center;gap:8px;height:var(--qb-band-h);padding:0 14px;background:var(--bg-head);border-bottom:1px solid var(--line);}.filters.svelte-iywwdf {background:var(--bg-strip);}.title.svelte-iywwdf {margin:0;font-family:var(--font-display);font-size:16px;font-weight:700;}.tabs.svelte-iywwdf {display:flex;align-items:center;gap:2px;padding:2px;border-radius:7px;background:var(--bg-sunken);}.tab.svelte-iywwdf {height:27px;padding:0 11px;border:0;border-radius:6px;background:transparent;color:var(--text-4);font-family:inherit;font-size:var(--qb-text-sm);font-weight:600;cursor:pointer;}.tab.on.svelte-iywwdf {background:var(--bg-raised);color:var(--text);}.totals.svelte-iywwdf {margin-left:auto;font-size:var(--qb-text-xs);color:var(--text-4);white-space:nowrap;}.search.svelte-iywwdf {flex:1 1 0;min-width:0;display:flex;align-items:center;gap:6px;height:34px;padding:0 11px;border-radius:8px;background:var(--bg-sunken);border:1px solid var(--line-soft);color:var(--text-4);}.search.svelte-iywwdf input:where(.svelte-iywwdf) {flex:1 1 0;min-width:0;border:0;background:transparent;color:var(--text);font-family:inherit;font-size:var(--qb-text);outline:none;}.chip.svelte-iywwdf {height:31px;padding:0 11px;border-radius:7px;background:transparent;border:1px dashed var(--chip-off-line);color:var(--chip-off-fg);font-family:inherit;font-size:var(--qb-text-sm);font-weight:600;white-space:nowrap;cursor:pointer;}.chip.on.svelte-iywwdf {background:var(--chip-blue-bg);border:1px solid var(--chip-blue-line);color:var(--blue-fg);}.filter-btn.svelte-iywwdf {position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:1px solid var(--line-soft);border-radius:8px;background:var(--bg-raised);color:var(--text-2);cursor:pointer;}.badge.svelte-iywwdf {position:absolute;top:-5px;right:-5px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:var(--accent);color:var(--accent-fg);font-size:9px;font-weight:700;line-height:14px;text-align:center;}\n\n  /* The accent tint marks the strip as the current target, not a heading. */.adds-to.svelte-iywwdf {flex:none;display:flex;align-items:center;gap:7px;height:46px;padding:0 14px;background:rgba(91, 155, 245, 0.1);border-bottom:1px solid var(--line);color:var(--blue-fg);}.adds-label.svelte-iywwdf {font-size:var(--qb-text);font-weight:600;}.target.svelte-iywwdf {display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:7px;background:var(--bg-raised);border:1px solid var(--line-soft);color:var(--text);font-family:inherit;font-size:var(--qb-text-sm);font-weight:600;white-space:nowrap;cursor:pointer;}.dot.svelte-iywwdf {width:7px;height:7px;border-radius:50%;background:var(--tone);}.tone-accent.svelte-iywwdf {--tone: var(--accent);}.tone-violet.svelte-iywwdf {--tone: var(--violet);}.tone-teal.svelte-iywwdf {--tone: var(--teal);}.tone-amber.svelte-iywwdf {--tone: var(--amber);}.tone-rose.svelte-iywwdf {--tone: var(--rose);}.drag-hint.svelte-iywwdf {margin-left:auto;font-size:var(--qb-text-xs);color:var(--text-5);}.columns.svelte-iywwdf {flex:none;display:flex;align-items:center;gap:10px;height:30px;padding:0 14px;border-bottom:1px solid var(--line);font-size:var(--qb-text-xs);font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--text-5);}.col-text.svelte-iywwdf {flex:1 1 0;}.col-count.svelte-iywwdf {flex:0 0 var(--qb-lib-count);text-align:right;}.col-action.svelte-iywwdf {flex:0 0 var(--qb-lib-action);}.list.svelte-iywwdf {flex:1 1 0;overflow-y:auto;overflow-x:hidden;}.hint.svelte-iywwdf {display:block;margin-top:8px;font-size:10.5px;color:var(--text-5);}code.svelte-iywwdf {font-family:var(--font-mono);font-size:10px;}.empty.svelte-iywwdf,\n  .capped.svelte-iywwdf {padding:22px 14px;text-align:center;font-size:var(--qb-text);color:var(--text-4);}.capped.svelte-iywwdf {border-top:1px solid var(--line);}'
	};

	function Library($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$q);

		const TABS = [
			{
				key: 'library',
				i18n: 'song_library.library',
				fallback: 'Library'
			},
			{ key: 'new', i18n: 'song_library.new_songs', fallback: 'New' },
			{
				key: 'wrong',
				i18n: 'song_library.recent_wrong',
				fallback: 'Wrong'
			}
		];

		const targetTone = user_derived(() => toneFor(Math.max(0, quizStore.quiz.blocks.findIndex((block) => block.id === quizStore.targetBlock?.id))));
		const targetPosition = user_derived(() => quizStore.quiz.blocks.findIndex((block) => block.id === quizStore.targetBlock?.id) + 1);
		let filterButton = state(null);
		let targetButton = state(null);
		var section = root_7();
		var header = child(section);
		var h2 = child(header);
		var text$1 = only_child(h2, true);
		var div = sibling(h2, 2);

		each(div, 21, () => TABS, (tab) => tab.key, ($$anchor, tab) => {
			var button = root$q();
			let classes;
			var text_1 = only_child(button, true);

			template_effect(
				($0) => {
					classes = set_class(button, 1, 'tab svelte-iywwdf', null, classes, { on: libraryFilters.state.tab === get(tab).key });
					set_attribute(button, 'aria-selected', libraryFilters.state.tab === get(tab).key);
					set_text(text_1, $0);
				},
				[() => t(get(tab).i18n, get(tab).fallback)]
			);

			delegated('click', button, () => libraryFilters.setTab(get(tab).key));
			append($$anchor, button);
		});

		var span = sibling(div, 2);
		var text_2 = only_child(span);

		var div_1 = sibling(header, 2);
		var label = child(div_1);
		var node = child(label);

		Icon(node, { name: 'search', size: 15 });

		var input = sibling(node, 2);

		var node_1 = sibling(label, 2);

		each(
			node_1,
			17,
			() => [
				{
					key: 'watched',
					label: t('song_library.filters.watched', 'Watched')
				},

				{
					key: 'unwatched',
					label: t('song_library.filters.unwatched', 'Unwatched')
				}
			],
			(chip) => chip.key,
			($$anchor, chip) => {
				var button_1 = root_1$n();
				let classes_1;
				var text_3 = only_child(button_1, true);

				template_effect(
					($0, $1) => {
						classes_1 = set_class(button_1, 1, 'chip svelte-iywwdf', null, classes_1, { on: $0 });
						set_attribute(button_1, 'aria-pressed', $1);
						set_text(text_3, get(chip).label);
					},
					[
						() => libraryFilters.toggles('watchStatus')[get(chip).key],
						() => libraryFilters.toggles('watchStatus')[get(chip).key]
					]
				);

				delegated('click', button_1, () => libraryFilters.toggle('watchStatus', get(chip).key));
				append($$anchor, button_1);
			}
		);

		var button_2 = sibling(node_1, 2);
		var node_2 = child(button_2);

		Icon(node_2, { name: 'filter', size: 16 });

		var node_3 = sibling(node_2, 2);

		{
			var consequent = ($$anchor) => {
				var span_1 = root_2$h();
				var text_4 = only_child(span_1, true);

				template_effect(() => set_text(text_4, libraryFilters.changedCount));
				append($$anchor, span_1);
			};

			if_block(node_3, ($$render) => {
				if (libraryFilters.changedCount > 0) $$render(consequent);
			});
		}
		bind_this(button_2, ($$value) => set(filterButton, $$value), () => get(filterButton));

		var div_2 = sibling(div_1, 2);
		var button_3 = sibling(child(div_2), 4);
		var span_2 = child(button_3);
		var text_5 = sibling(span_2);
		var node_4 = sibling(text_5);

		Icon(node_4, { name: 'caret', size: 11 });
		bind_this(button_3, ($$value) => set(targetButton, $$value), () => get(targetButton));

		var div_3 = sibling(div_2, 4);
		var node_5 = child(div_3);

		each(
			node_5,
			17,
			() => libraryStore.rows,
			(row) => row.id,
			($$anchor, row) => {
				{
					let $0 = user_derived(() => get(row).kind === 'anime' && libraryStore.expanded.has(get(row).annId));

					LibraryRow($$anchor, {
						get row() {
							return get(row);
						},

						get expanded() {
							return get($0);
						},
						onToggle: () => get(row).kind === 'anime' && libraryStore.toggle(get(row).annId),
						onAdd: () => get(row).kind === 'anime'
							? $$props.onAddAnime(get(row).annId)
							: $$props.onAddSong(get(row).annSongId),

						onAddTo: (anchor) => $$props.onPickTarget(anchor, () => get(row).kind === 'anime'
							? $$props.onAddAnime(get(row).annId)
							: $$props.onAddSong(get(row).annSongId))
					});
				}
			},
			($$anchor) => {
				var p = root_5$6();
				var node_6 = child(p);

				{
					var consequent_1 = ($$anchor) => {
						var text_6 = text('Loading the library…');

						append($$anchor, text_6);
					};

					var consequent_2 = ($$anchor) => {
						var fragment_1 = root_3$c();
						append($$anchor, fragment_1);
					};

					var consequent_3 = ($$anchor) => {
						var fragment_2 = root_4$7();
						append($$anchor, fragment_2);
					};

					var alternate = ($$anchor) => {
						var text_7 = text('No anime or songs match these filters.');

						append($$anchor, text_7);
					};

					if_block(node_6, ($$render) => {
						if (libraryStore.loading) $$render(consequent_1); else if (libraryStore.broken) $$render(consequent_2, 1); else if (libraryStore.failed) $$render(consequent_3, 2); else $$render(alternate, -1);
					});
				}
				append($$anchor, p);
			}
		);

		var node_7 = sibling(node_5, 2);

		{
			var consequent_4 = ($$anchor) => {
				var p_1 = root_6$2();
				var text_8 = only_child(p_1);

				template_effect(() => set_text(text_8, `Showing the first ${libraryStore.shown ?? ''} of ${libraryStore.total ?? ''} . Search to
        narrow the list.`));

				append($$anchor, p_1);
			};

			if_block(node_7, ($$render) => {
				if (libraryStore.capped) $$render(consequent_4);
			});
		}

		template_effect(
			($0, $1) => {
				set_text(text$1, $0);
				set_text(text_2, `${libraryStore.animeTotal ?? ''} anime · ${libraryStore.songTotal ?? ''} songs`);
				set_value(input, libraryFilters.draft);
				set_class(span_2, 1, `dot tone-${get(targetTone) ?? ''}`, 'svelte-iywwdf');

				set_text(text_5, ` ${$1 ?? ''}
      ${get(targetPosition) ?? ''} `);
			},
			[
				() => t('song_library.title', 'Library'),
				() => t('quiz_builder.rule_block.title', 'Rule Block')
			]
		);

		delegated('input', input, (event) => libraryFilters.setSearch(event.currentTarget.value));
		delegated('click', button_2, () => get(filterButton) && $$props.onOpenFilters(get(filterButton)));
		delegated('click', button_3, () => get(targetButton) && $$props.onPickTarget(get(targetButton)));
		append($$anchor, section);
		pop();
	}

	delegate(['click', 'input']);

	var root$p = from_html(`<span class="text svelte-1u1i0cm"> </span>`);
	var root_1$m = from_html(`<span class="tip-anchor svelte-1u1i0cm" role="presentation"><!></span> <!>`, 1);

	const $$css$p = {
		hash: 'svelte-1u1i0cm',
		code: '.tip-anchor.svelte-1u1i0cm {display:inline-flex;}.text.svelte-1u1i0cm {display:block;font-size:12px;font-weight:400;line-height:1.45;white-space:normal;}'
	};

	function Tooltip($$anchor, $$props) {
		append_styles$1($$anchor, $$css$p);

		let placement = prop($$props, 'placement', 3, 'below'),
			wide = prop($$props, 'wide', 3, false);

		let anchor = state(null);
		let open = state(false);
		var fragment = root_1$m();
		var span = first_child(fragment);
		var node = child(span);

		snippet(node, () => $$props.children);
		bind_this(span, ($$value) => set(anchor, $$value), () => get(anchor));

		var node_1 = sibling(span, 2);

		{
			var consequent = ($$anchor) => {
				{
					let $0 = user_derived(() => wide() ? 340 : 260);

					Floating($$anchor, {
						get anchor() {
							return get(anchor);
						},

						get placement() {
							return placement();
						},

						get maxWidth() {
							return get($0);
						},
						onDismiss: () => set(open, false),
						children: ($$anchor, $$slotProps) => {
							var span_1 = root$p();
							var text_1 = only_child(span_1, true);

							template_effect(() => set_text(text_1, $$props.text));
							append($$anchor, span_1);
						},
						$$slots: { default: true }
					});
				}
			};

			if_block(node_1, ($$render) => {
				if (get(open) && get(anchor)) $$render(consequent);
			});
		}

		event('mouseenter', span, () => set(open, true));
		event('mouseleave', span, () => set(open, false));
		delegated('focusin', span, () => set(open, true));
		delegated('focusout', span, () => set(open, false));
		append($$anchor, fragment);
	}

	delegate(['focusin', 'focusout']);

	var root$o = from_html(`<span class="rail up svelte-192qg3i" aria-hidden="true"></span>`);
	var root_1$l = from_html(`<span class="rail down svelte-192qg3i" aria-hidden="true"></span>`);
	var root_2$g = from_html(`<button type="button"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 14.5l5-5M8 12l-2 2a3.5 3.5 0 105 5l2-2M16 12l2-2a3.5 3.5 0 10-5-5l-2 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path></svg></button>`);
	var root_3$b = from_html(`<div class="gutter svelte-192qg3i"><!> <!> <!></div>`);

	const $$css$o = {
		hash: 'svelte-192qg3i',
		code: '.gutter.svelte-192qg3i {position:relative;flex:0 0 var(--qb-chain);align-self:stretch;}\n\n  /* Each half is 50% high. The halves meet at the row boundary. */.rail.svelte-192qg3i {position:absolute;left:50%;width:2px;margin-left:-1px;background:var(--accent);border-radius:1px;}.up.svelte-192qg3i {top:0;height:50%;}.down.svelte-192qg3i {top:50%;height:50%;}\n\n  /*\n   * Centred on the row boundary: half of it overhangs the row above.\n   * `z-index` keeps it above the rail.\n   */.link.svelte-192qg3i {position:absolute;top:0;left:50%;z-index:1;transform:translate(-50%, -50%);display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;padding:0;border:0;border-radius:4px;background:var(--bg-list);color:var(--text-5);cursor:pointer;opacity:0.3;}.link.svelte-192qg3i:hover,\n  .link.svelte-192qg3i:focus-visible {opacity:1;color:var(--accent-soft);}.link.on.svelte-192qg3i {opacity:1;color:var(--accent);}'
	};

	function ChainGutter($$anchor, $$props) {
		append_styles$1($$anchor, $$css$o);

		var div = root_3$b();
		var node = child(div);

		{
			var consequent = ($$anchor) => {
				var span = root$o();

				append($$anchor, span);
			};

			if_block(node, ($$render) => {
				if ($$props.chainedUp) $$render(consequent);
			});
		}

		var node_1 = sibling(node, 2);

		{
			var consequent_1 = ($$anchor) => {
				var span_1 = root_1$l();

				append($$anchor, span_1);
			};

			if_block(node_1, ($$render) => {
				if ($$props.chainedDown) $$render(consequent_1);
			});
		}

		var node_2 = sibling(node_1, 2);

		{
			var consequent_2 = ($$anchor) => {
				var button = root_2$g();
				let classes;

				template_effect(() => {
					classes = set_class(button, 1, 'link svelte-192qg3i', null, classes, { on: $$props.chainedUp });
					set_attribute(button, 'aria-pressed', $$props.chainedUp);
					set_attribute(button, 'aria-label', $$props.label);
					set_attribute(button, 'title', $$props.label);
				});

				delegated('click', button, function (...$$args) {
					$$props.onToggle?.apply(this, $$args);
				});

				append($$anchor, button);
			};

			if_block(node_2, ($$render) => {
				if ($$props.canChainUp) $$render(consequent_2);
			});
		}
		append($$anchor, div);
	}

	delegate(['click']);

	var root$n = from_html(`<div class="pick svelte-duxq9o"><div class="track-host svelte-duxq9o"><span class="track svelte-duxq9o" aria-hidden="true"></span> <span class="fill svelte-duxq9o" aria-hidden="true"></span> <input class="rng svelte-duxq9o" type="range" min="1" step="1"/></div> <div class="stepper svelte-duxq9o"><button type="button" class="step svelte-duxq9o" aria-label="One fewer">−</button> <span class="count mono svelte-duxq9o"> </span> <button type="button" class="step svelte-duxq9o" aria-label="One more">+</button></div></div>`);

	const $$css$n = {
		hash: 'svelte-duxq9o',
		code: '.pick.svelte-duxq9o {flex:0 0 var(--qb-pick);display:flex;flex-direction:column;justify-content:center;gap:2px;}.track-host.svelte-duxq9o {position:relative;height:3px;}.track.svelte-duxq9o,\n  .fill.svelte-duxq9o {position:absolute;top:0;left:0;height:3px;border-radius:2px;}.track.svelte-duxq9o {width:100%;background:var(--bg-sunken);}.fill.svelte-duxq9o {background:var(--accent);}\n\n  /*\n   * The input covers the track so the whole width is draggable, but only the\n   * thumb accepts the pointer. Otherwise any click in the 74px cell would\n   * change the value.\n   */.rng.svelte-duxq9o {position:absolute;top:-5px;left:0;width:100%;height:13px;margin:0;padding:0;background:transparent;appearance:none;pointer-events:none;}.rng.svelte-duxq9o::-webkit-slider-thumb {appearance:none;width:9px;height:9px;border:0;border-radius:50%;background:var(--accent-soft);cursor:pointer;pointer-events:auto;}.rng.svelte-duxq9o::-moz-range-thumb {width:9px;height:9px;border:0;border-radius:50%;background:var(--accent-soft);cursor:pointer;pointer-events:auto;}.rng.svelte-duxq9o::-moz-range-track {background:transparent;}.stepper.svelte-duxq9o {display:flex;align-items:center;justify-content:space-between;}.step.svelte-duxq9o {width:13px;height:13px;padding:0;border:0;border-radius:3px;background:transparent;color:var(--text-4);font-size:12px;line-height:1;cursor:pointer;}.step.svelte-duxq9o:hover:not(:disabled) {background:var(--bg-raised);color:var(--text);}.step.svelte-duxq9o:disabled {opacity:0.35;cursor:default;}.count.svelte-duxq9o {font-size:10.5px;color:var(--text-3);}'
	};

	function PickCount($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$n);

		// An empty pool still shows a maximum of 1, so the control never reads
		// `1/0`.
		const max = user_derived(() => Math.max($$props.pool, 1));

		const pct = user_derived(() => get(max) <= 1 ? 100 : ($$props.value - 1) / (get(max) - 1) * 100);
		var div = root$n();
		var div_1 = child(div);
		var span = sibling(child(div_1), 2);
		let styles;
		var input = sibling(span, 2);

		var div_2 = sibling(div_1, 2);
		var button = child(div_2);
		var span_1 = sibling(button, 2);
		var text = only_child(span_1);
		var button_1 = sibling(span_1, 2);

		template_effect(() => {
			styles = set_style(span, '', styles, { width: `${get(pct) ?? ''}%` });
			set_attribute(input, 'max', get(max));
			set_value(input, $$props.value);
			set_attribute(input, 'aria-label', $$props.label);
			button.disabled = $$props.value <= 1;
			set_text(text, `${$$props.value ?? ''}/${$$props.pool ?? ''}`);
			button_1.disabled = $$props.value >= get(max);
		});

		delegated('input', input, (event) => $$props.onChange(Number(event.currentTarget.value)));
		delegated('click', button, () => $$props.onChange($$props.value - 1));
		delegated('click', button_1, () => $$props.onChange($$props.value + 1));
		append($$anchor, div);
		pop();
	}

	delegate(['input', 'click']);

	var root$m = from_html(`<button type="button"> <span class="n svelte-1a9aku4"> </span></button>`);
	var root_1$k = from_html(`<span class="badge svelte-1a9aku4"> </span>`);
	var root_2$f = from_html(`<span class="title svelte-1a9aku4"> </span> <span class="artist svelte-1a9aku4"> </span>`, 1);
	var root_3$a = from_html(`<span class="pick-spacer svelte-1a9aku4" aria-hidden="true"></span>`);
	var root_4$6 = from_html(`<button type="button"> </button>`);
	var root_5$5 = from_html(`<div draggable="true" role="presentation"><!> <span class="grip svelte-1a9aku4" aria-hidden="true"><svg width="8" height="14" viewBox="0 0 7 12" fill="currentColor"><circle cx="1.5" cy="2" r="1"></circle><circle cx="5.5" cy="2" r="1"></circle><circle cx="1.5" cy="6" r="1"></circle><circle cx="5.5" cy="6" r="1"></circle><circle cx="1.5" cy="10" r="1"></circle><circle cx="5.5" cy="10" r="1"></circle></svg></span> <label class="check svelte-1a9aku4"><input type="checkbox" class="svelte-1a9aku4"/> <span class="sr-only"> </span></label> <span class="anime svelte-1a9aku4"> </span> <div class="types svelte-1a9aku4"><!></div> <div class="song svelte-1a9aku4"><!></div> <!> <div class="overrides svelte-1a9aku4"></div> <div class="actions svelte-1a9aku4"><button type="button" class="act settings svelte-1a9aku4" aria-label="Entry settings" title="Entry settings"><!></button> <button type="button" aria-label="Keep this entry's position when the block is shuffled" title="Keep this entry's position when the block is shuffled"><!></button> <button type="button" class="act menu svelte-1a9aku4" aria-label="More actions" title="More actions">⋯</button></div></div>`);

	const $$css$m = {
		hash: 'svelte-1a9aku4',
		code: '.row.svelte-1a9aku4 {display:flex;align-items:center;gap:var(--qb-row-gap);height:var(--qb-entry-h);padding:0 12px 0 var(--qb-row-pad-left);position:relative;}.row.svelte-1a9aku4:hover {background:rgba(255, 255, 255, 0.04);}\n\n  /* An inset bar marks the selection without tinting the text. */.row.selected.svelte-1a9aku4 {background:rgba(91, 155, 245, 0.13);box-shadow:inset 3px 0 0 var(--accent);}\n\n  /* The anime is not in the cache. See library.svelte.ts. */.row.unknown.svelte-1a9aku4 .anime:where(.svelte-1a9aku4) {color:var(--text-5);font-style:italic;}.grip.svelte-1a9aku4 {flex:0 0 var(--qb-grip);display:flex;align-items:center;color:var(--text-5);cursor:grab;}.check.svelte-1a9aku4 {flex:0 0 var(--qb-check);display:flex;align-items:center;}.check.svelte-1a9aku4 input:where(.svelte-1a9aku4) {width:var(--qb-check);height:var(--qb-check);margin:0;accent-color:var(--accent);cursor:pointer;}\n\n  /* Both text columns flex and share the free width. See `--qb-anime-min`. */.anime.svelte-1a9aku4 {flex:1 1 0;min-width:var(--qb-anime-min);font-size:var(--qb-text);font-weight:500;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.types.svelte-1a9aku4 {flex:0 0 var(--qb-types);min-width:var(--qb-types);display:flex;align-items:center;gap:4px;}\n\n  /* Off is dashed and unfilled: the type exists but adds no songs. */.type.svelte-1a9aku4 {display:inline-flex;align-items:center;gap:3px;height:24px;padding:0 8px;border-radius:5px;background:transparent;border:1px dashed var(--chip-off-line);color:var(--chip-off-fg);font-family:var(--font-mono);font-size:var(--qb-badge);font-weight:600;cursor:pointer;}.type.on.svelte-1a9aku4 {background:var(--chip-blue-bg);border:1px solid var(--chip-blue-line);color:var(--blue-fg);}.type.svelte-1a9aku4 .n:where(.svelte-1a9aku4) {opacity:0.75;}.badge.svelte-1a9aku4 {display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:5px;background:var(--chip-teal-bg);border:1px solid var(--chip-teal-line);color:var(--teal-fg);font-family:var(--font-mono);font-size:var(--qb-badge);font-weight:600;}\n\n  /*\n   * Two lines of text in one entry row. Keep the line heights tight: a looser\n   * value pushes the artist\'s descenders past the row edge.\n   */.song.svelte-1a9aku4 {flex:1 1 0;min-width:var(--qb-song-min);display:flex;flex-direction:column;justify-content:center;line-height:1.15;}.title.svelte-1a9aku4,\n  .artist.svelte-1a9aku4 {white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.title.svelte-1a9aku4 {font-size:var(--qb-text-sm);font-weight:500;color:var(--text);}.artist.svelte-1a9aku4 {font-size:var(--qb-text-xs);color:var(--text-4);}\n\n  /* Keeps a song row\'s later columns aligned with an anime row\'s. */.pick-spacer.svelte-1a9aku4 {flex:0 0 var(--qb-pick);}.overrides.svelte-1a9aku4 {flex:0 0 var(--qb-overrides);min-width:0;display:flex;align-items:center;gap:4px;overflow:hidden;}.chip.svelte-1a9aku4 {display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:5px;background:var(--chip-amber-bg);border:1px solid var(--chip-amber-line);color:var(--amber-fg);font-family:var(--font-mono);font-size:var(--qb-text-xs);font-weight:600;white-space:nowrap;cursor:pointer;}\n\n  /* A random range has no editor. Its panel opens read-only. */.chip.readonly.svelte-1a9aku4 {border-style:dashed;}.actions.svelte-1a9aku4 {flex:0 0 var(--qb-actions);display:flex;align-items:center;justify-content:flex-end;gap:3px;}.act.svelte-1a9aku4 {display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--text-4);font-size:16px;line-height:1;cursor:pointer;}.act.svelte-1a9aku4:hover {background:var(--bg-raised);color:var(--text);}.act.lock.on.svelte-1a9aku4 {background:rgba(91, 155, 245, 0.2);border-color:rgba(91, 155, 245, 0.45);color:var(--accent-soft);}'
	};

	function EntryRow($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$m);

		const anime = user_derived(() => $$props.entry.kind === 'anime'
			? describeAnime($$props.entry.annId)
			: describeSong($$props.entry.annSongId));

		const song = user_derived(() => $$props.entry.kind === 'song' ? describeSong($$props.entry.annSongId) : null);
		const animeName = user_derived(() => $$props.entry.kind === 'anime' ? get(anime).name : get(song)?.animeName ?? '');

		// Counts come from the cache, never from the entry. They reflect the
		// current library, not the library at save time.
		const counts = user_derived(() => $$props.entry.kind === 'anime'
			? describeAnime($$props.entry.annId)
			: { opCount: 0, edCount: 0, insCount: 0 });

		const chips = user_derived(() => overrideChips($$props.entry.overrides));

		const TYPES = [
			{
				key: 'op',
				i18n: 'quiz_builder.algorithm_block.song_type.opening',
				fallback: 'OP'
			},

			{
				key: 'ed',
				i18n: 'quiz_builder.algorithm_block.song_type.ending',
				fallback: 'ED'
			},

			{
				key: 'in',
				i18n: 'quiz_builder.algorithm_block.song_type.insert',
				fallback: 'IN'
			}
		];

		function typeCount(key) {
			if (key === 'op') return get(counts).opCount;
			if (key === 'ed') return get(counts).edCount;

			return get(counts).insCount;
		}

		let menuButton = state(null);

		/**
		 * Decides whether the row can start a drag.
		 *
		 * The whole row is draggable. An HTML5 drag that starts on a child still
		 * drags the parent, so a press on the pick slider would drag the row. This
		 * handler turns the row's `draggable` off for such a press.
		 *
		 * The attribute is set **imperatively**, not bound to state. The browser
		 * reads it when `dragstart` fires, and a reactive update is flushed too
		 * late for that.
		 */
		function onPointerDown(event) {
			const row = event.currentTarget;
			const target = event.target;

			row.draggable = !target?.closest('input, button, label, .pick');
		}

		function armDrag(event) {
			event.currentTarget.draggable = true;
		}

		var div = root_5$5();
		let classes;
		var node = child(div);

		{
			let $0 = user_derived(() => t('quiz_builder.rule_labels.connect_description', 'Connect these blocks, making them always appear next to each other in the quiz'));

			ChainGutter(node, {
				get canChainUp() {
					return $$props.canChainUp;
				},

				get chainedUp() {
					return $$props.chainedUp;
				},

				get chainedDown() {
					return $$props.chainedDown;
				},

				get onToggle() {
					return $$props.onToggleChain;
				},

				get label() {
					return get($0);
				}
			});
		}

		var label = sibling(node, 4);
		var input = child(label);

		var span = sibling(input, 2);
		var text = only_child(span);

		var span_1 = sibling(label, 2);
		var text_1 = only_child(span_1, true);
		var div_1 = sibling(span_1, 2);
		var node_1 = child(div_1);

		{
			var consequent = ($$anchor) => {
				var fragment = comment();
				var node_2 = first_child(fragment);

				each(node_2, 17, () => TYPES, (type) => type.key, ($$anchor, type) => {
					var button = root$m();
					let classes_1;
					var text_2 = child(button);
					var span_2 = sibling(text_2);
					var text_3 = only_child(span_2, true);

					template_effect(
						($0, $1) => {
							classes_1 = set_class(button, 1, 'type svelte-1a9aku4', null, classes_1, { on: $$props.entry.includeSongTypes[get(type).key] });
							set_attribute(button, 'aria-pressed', $$props.entry.includeSongTypes[get(type).key]);
							set_text(text_2, `${$0 ?? ''} `);
							set_text(text_3, $1);
						},
						[
							() => t(get(type).i18n, get(type).fallback),
							() => typeCount(get(type).key)
						]
					);

					delegated('click', button, () => $$props.onToggleType(get(type).key));
					append($$anchor, button);
				});

				append($$anchor, fragment);
			};

			var consequent_1 = ($$anchor) => {
				var span_3 = root_1$k();
				var text_4 = only_child(span_3, true);

				template_effect(() => set_text(text_4, get(song).badge));
				append($$anchor, span_3);
			};

			if_block(node_1, ($$render) => {
				if ($$props.entry.kind === 'anime') $$render(consequent); else if (get(song)) $$render(consequent_1, 1);
			});
		}

		var div_2 = sibling(div_1, 2);
		var node_3 = child(div_2);

		{
			var consequent_2 = ($$anchor) => {
				var fragment_1 = root_2$f();
				var span_4 = first_child(fragment_1);
				var text_5 = only_child(span_4, true);
				var span_5 = sibling(span_4, 2);
				var text_6 = only_child(span_5, true);

				template_effect(() => {
					set_attribute(span_4, 'title', get(song).title);
					set_text(text_5, get(song).title);
					set_attribute(span_5, 'title', get(song).artist);
					set_text(text_6, get(song).artist);
				});

				append($$anchor, fragment_1);
			};

			if_block(node_3, ($$render) => {
				if (get(song)) $$render(consequent_2);
			});
		}

		var node_4 = sibling(div_2, 2);

		{
			var consequent_3 = ($$anchor) => {
				{
					let $0 = user_derived(() => t('quiz_builder.anime_block.number_of_songs_selected.description', 'Number of Songs Selected from this Anime Block'));

					PickCount($$anchor, {
						get value() {
							return $$props.entry.numberOfSongs;
						},

						get pool() {
							return $$props.pool;
						},

						get onChange() {
							return $$props.onPick;
						},

						get label() {
							return get($0);
						}
					});
				}
			};

			var alternate = ($$anchor) => {
				var span_6 = root_3$a();

				append($$anchor, span_6);
			};

			if_block(node_4, ($$render) => {
				if ($$props.entry.kind === 'anime') $$render(consequent_3); else $$render(alternate, -1);
			});
		}

		var div_3 = sibling(node_4, 2);

		each(div_3, 21, () => get(chips), (chip) => chip.key, ($$anchor, chip) => {
			Tooltip($$anchor, {
				get text() {
					return get(chip).tooltip;
				},

				children: ($$anchor, $$slotProps) => {
					var button_1 = root_4$6();
					let classes_2;
					var text_7 = only_child(button_1, true);

					template_effect(() => {
						classes_2 = set_class(button_1, 1, 'chip svelte-1a9aku4', null, classes_2, { readonly: get(chip).readOnly });
						set_text(text_7, get(chip).label);
					});

					delegated('click', button_1, function (...$$args) {
						$$props.onSettings?.apply(this, $$args);
					});

					append($$anchor, button_1);
				},
				$$slots: { default: true }
			});
		});

		var div_4 = sibling(div_3, 2);
		var button_2 = child(div_4);
		var node_5 = child(button_2);

		Icon(node_5, { name: 'sliders', size: 16 });

		var button_3 = sibling(button_2, 2);
		let classes_3;
		var node_6 = child(button_3);

		Icon(node_6, { name: 'lock', size: 16 });

		var button_4 = sibling(button_3, 2);

		bind_this(button_4, ($$value) => set(menuButton, $$value), () => get(menuButton));

		template_effect(() => {
			classes = set_class(div, 1, 'row svelte-1a9aku4', null, classes, { selected: $$props.selected, unknown: !get(anime).known });
			set_checked(input, $$props.selected);
			set_text(text, `Select ${get(animeName) ?? ''}`);
			set_attribute(span_1, 'title', get(animeName));
			set_text(text_1, get(animeName));
			classes_3 = set_class(button_3, 1, 'act lock svelte-1a9aku4', null, classes_3, { on: $$props.entry.locked });
			set_attribute(button_3, 'aria-pressed', $$props.entry.locked);
		});

		delegated('pointerdown', div, onPointerDown);
		delegated('pointerup', div, armDrag);

		event('dragstart', div, (event) => {
			// Firefox does not start a drag unless the transfer has data.
			event.dataTransfer?.setData('text/plain', $$props.entry.id);

			if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';

			$$props.onDragStart();
		});

		event('dragend', div, (event) => {
			armDrag(event);
			$$props.onDragEnd();
		});

		delegated('click', input, (event) => $$props.onSelect(event));

		delegated('click', button_2, function (...$$args) {
			$$props.onSettings?.apply(this, $$args);
		});

		delegated('click', button_3, function (...$$args) {
			$$props.onToggleLock?.apply(this, $$args);
		});

		delegated('click', button_4, () => get(menuButton) && $$props.onMenu(get(menuButton)));
		append($$anchor, div);
		pop();
	}

	delegate(['pointerdown', 'pointerup', 'click']);

	function songSelectionLabel(settings) {
	  const advanced = settings?.songSelection?.advancedValue;
	  if (!advanced) return "";
	  const { watched = 0, unwatched = 0, random = 0 } = advanced;
	  if (watched === 0 && unwatched === 0) {
	    return t("quiz_builder.algorithm_block.song_selection.random", "Random");
	  }
	  if (unwatched === 0 && random === 0) {
	    return t("quiz_builder.algorithm_block.song_selection.watched", "Watched");
	  }
	  if (watched === 0 && random === 0) {
	    return t(
	      "quiz_builder.algorithm_block.song_selection.unwatched",
	      "Unwatched"
	    );
	  }
	  return t("quiz_builder.algorithm_block.song_selection.mixed", "Mixed");
	}
	function difficultyLabel(settings) {
	  const difficulty = settings?.songDifficulity;
	  if (!difficulty) return "";
	  const { advancedOn, standardValue, advancedValue } = difficulty;
	  if (advancedOn) return `${advancedValue[0]}-${advancedValue[1]}`;
	  let min = 100;
	  let max = 0;
	  const bands = [
	    ["beginner", 70, 100],
	    ["easy", 50, 70],
	    ["medium", 25, 50],
	    ["hard", 15, 25],
	    ["expert", 0, 15]
	  ];
	  for (const [key, low, high] of bands) {
	    if (standardValue?.[key]) {
	      min = Math.min(min, low);
	      max = Math.max(max, high);
	    }
	  }
	  return `${min}-${max}`;
	}
	function vintageLabel(settings) {
	  const vintage = settings?.vintage;
	  if (!vintage) return "";
	  const { standardValue, advancedValueList = [] } = vintage;
	  if (advancedValueList.length === 0) {
	    return `${standardValue?.years?.[0]}-${standardValue?.years?.[1]}`;
	  }
	  let min = 9999;
	  let max = 0;
	  for (const { years } of advancedValueList) {
	    min = Math.min(min, years[0]);
	    max = Math.max(max, years[1]);
	  }
	  return `${min}-${max}`;
	}
	function songTypesLabel(settings) {
	  const type = settings?.songType;
	  if (!type) return "";
	  const on = type.advancedOn ? {
	    op: (type.advancedValue?.openings ?? 0) > 0,
	    ed: (type.advancedValue?.endings ?? 0) > 0,
	    in: (type.advancedValue?.inserts ?? 0) > 0
	  } : {
	    op: Boolean(type.standardValue?.openings),
	    ed: Boolean(type.standardValue?.endings),
	    in: Boolean(type.standardValue?.inserts)
	  };
	  const parts = [];
	  if (on.op)
	    parts.push(t("quiz_builder.algorithm_block.song_type.opening", "OP"));
	  if (on.ed)
	    parts.push(t("quiz_builder.algorithm_block.song_type.ending", "ED"));
	  if (on.in)
	    parts.push(t("quiz_builder.algorithm_block.song_type.insert", "IN"));
	  return parts.join(" · ");
	}
	function algorithmChips(settings) {
	  const chips = [];
	  const add = (key, label, tooltip) => {
	    if (label) chips.push({ key, label, tooltip });
	  };
	  add(
	    "selection",
	    songSelectionLabel(settings),
	    t("quiz_builder.algorithm_block.popovers.song_selection", "Song Selection")
	  );
	  add(
	    "types",
	    songTypesLabel(settings),
	    t("quiz_builder.algorithm_block.popovers.song_types", "Song Types")
	  );
	  add(
	    "vintage",
	    vintageLabel(settings),
	    t("quiz_builder.algorithm_block.popovers.vintage", "Vintage")
	  );
	  add(
	    "difficulty",
	    difficultyLabel(settings),
	    t(
	      "quiz_builder.algorithm_block.popovers.song_difficulty",
	      "Song Difficulty"
	    )
	  );
	  const genres = settings?.genre?.length ?? 0;
	  const tags = settings?.tags?.length ?? 0;
	  if (genres > 0) {
	    add(
	      "genres",
	      `${genres} ${genres === 1 ? "Genre" : "Genres"}`,
	      t(
	        "quiz_builder.algorithm_block.popovers.genre_count",
	        "Number of selected genres"
	      )
	    );
	  }
	  if (tags > 0) {
	    add(
	      "tags",
	      `${tags} ${tags === 1 ? "Tag" : "Tags"}`,
	      t(
	        "quiz_builder.algorithm_block.popovers.tag_count",
	        "Number of selected tags"
	      )
	    );
	  }
	  return chips;
	}

	var root$l = from_html(`<span class="chip svelte-11qe3ec"> </span>`);
	var root_1$j = from_html(`<div class="chips svelte-11qe3ec"></div>`);
	var root_2$e = from_html(`<span class="match svelte-11qe3ec"> </span> <!>`, 1);
	var root_3$9 = from_html(`<span class="content svelte-11qe3ec"> </span> <span class="when svelte-11qe3ec"> </span>`, 1);
	var root_4$5 = from_html(`<button type="button" class="act svelte-11qe3ec" aria-label="Algorithm block settings" title="Algorithm block settings"><!></button>`);
	var root_5$4 = from_html(`<div><span class="rail svelte-11qe3ec" aria-hidden="true"></span> <div class="body svelte-11qe3ec"><div class="line svelte-11qe3ec"><label class="check svelte-11qe3ec"><input type="checkbox" class="svelte-11qe3ec"/> <span class="sr-only"> </span></label> <span> </span> <!> <div class="actions svelte-11qe3ec"><!> <button type="button" class="act svelte-11qe3ec" aria-label="Duplicate this block" title="Duplicate this block. The copy goes directly below."><!></button> <button type="button" class="act svelte-11qe3ec" aria-label="More actions" title="More actions">⋯</button></div></div></div></div>`);

	const $$css$l = {
		hash: 'svelte-11qe3ec',
		code: '.nested.svelte-11qe3ec {position:relative;display:flex;padding-left:var(--qb-chain);}.nested.svelte-11qe3ec:hover {background:rgba(255, 255, 255, 0.04);}.nested.selected.svelte-11qe3ec {background:rgba(91, 155, 245, 0.13);box-shadow:inset 3px 0 0 var(--accent);}\n\n  /* The rail has the colour of the rule block that contains this row. */.rail.svelte-11qe3ec {position:absolute;left:var(--qb-chain);top:0;bottom:0;width:2px;background:var(--tone);opacity:0.75;}.tone-accent.svelte-11qe3ec {--tone: var(--accent);}.tone-violet.svelte-11qe3ec {--tone: var(--violet);}.tone-teal.svelte-11qe3ec {--tone: var(--teal);}.tone-amber.svelte-11qe3ec {--tone: var(--amber);}.tone-rose.svelte-11qe3ec {--tone: var(--rose);}.body.svelte-11qe3ec {flex:1 1 0;min-width:0;\n    /* The padding puts the checkbox on `--qb-check-x`, aligned with the\n       entry rows. */padding:0 12px 0 calc(var(--qb-check-x) - var(--qb-chain));}.line.svelte-11qe3ec {display:flex;align-items:center;gap:var(--qb-row-gap);height:var(--qb-entry-h);}.check.svelte-11qe3ec {flex:0 0 var(--qb-check);display:flex;align-items:center;}.check.svelte-11qe3ec input:where(.svelte-11qe3ec) {width:var(--qb-check);height:var(--qb-check);margin:0;accent-color:var(--accent);cursor:pointer;}.tag.svelte-11qe3ec {flex:none;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:5px;font-size:var(--qb-text-xs);font-weight:700;letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;}.kind-algorithm.svelte-11qe3ec {background:var(--chip-teal-bg);color:var(--teal-fg);}.kind-message.svelte-11qe3ec {background:var(--chip-amber-bg);color:var(--amber-fg);}.kind-title.svelte-11qe3ec {background:var(--chip-rose-bg);color:var(--rose-fg);}.match.svelte-11qe3ec {flex:none;font-size:var(--qb-text-sm);color:var(--text-3);white-space:nowrap;}.content.svelte-11qe3ec {flex:1 1 0;min-width:0;font-size:var(--qb-text);color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.when.svelte-11qe3ec {flex:none;font-size:var(--qb-text-xs);color:var(--text-4);white-space:nowrap;}.actions.svelte-11qe3ec {flex:none;display:flex;align-items:center;gap:3px;}.act.svelte-11qe3ec {display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-4);font-size:16px;line-height:1;cursor:pointer;}.act.svelte-11qe3ec:hover {background:var(--bg-raised);color:var(--text);}\n\n  /* Takes the free width between the summary and the action buttons. Clips;\n     the line has a fixed height and must not wrap. */.chips.svelte-11qe3ec {flex:1 1 0;min-width:0;display:flex;align-items:center;gap:5px;overflow:hidden;}.chip.svelte-11qe3ec {display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:5px;background:var(--bg-raised);border:1px solid var(--line-soft);color:var(--text-3);font-family:var(--font-mono);font-size:var(--qb-text-xs);white-space:nowrap;}'
	};

	function NestedBlock($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$l);

		const isAlgorithm = user_derived(() => $$props.entry.kind === 'algorithm');

		const badge = user_derived(() => $$props.entry.kind === 'algorithm'
			? t('quiz_builder.algorithm_button.title', 'Algorithm Block')
			: $$props.entry.kind === 'message'
				? t('quiz_builder.message_button.title', 'Message Block')
				: t('quiz_builder.title_button.title', 'Title Block'));

		const chips = user_derived(() => $$props.entry.kind === 'algorithm' ? algorithmChips($$props.entry.settings) : []);

		/**
		 * "N matching songs · M chosen". The server sends the match count
		 * asynchronously. Until it arrives, the line says the count is pending; it
		 * does not show zero.
		 */
		const matchLine = user_derived(() => {
			if ($$props.entry.kind !== 'algorithm') return '';

			const wanted = Number($$props.entry.settings?.numberOfSongs ?? 0);
			const matched = $$props.entry.matchedAnnSongIds;

			if (matched === undefined) return `… · ${wanted} chosen`;

			return `${matched.length} matching songs · ${Math.min(wanted, matched.length || wanted)} chosen`;
		});

		/** When a message or title block shows (SPEC §5.3). */
		const whenLine = user_derived(() => {
			if ($$props.entry.kind === 'message') {
				const where = $$props.entry.videoDisplay ? 'during guessing' : 'chat';

				return `${where} · ${$$props.entry.time}s`;
			}

			if ($$props.entry.kind === 'title') return 'full screen';

			return '';
		});

		const content = user_derived(() => $$props.entry.kind === 'message'
			? $$props.entry.message
			: $$props.entry.kind === 'title' ? $$props.entry.title : '');

		let menuButton = state(null);
		var div = root_5$4();
		let classes;
		var div_1 = sibling(child(div), 2);
		var div_2 = child(div_1);
		var label = child(div_2);
		var input = child(label);

		var span = sibling(input, 2);
		var text = only_child(span);

		var span_1 = sibling(label, 2);
		var text_1 = only_child(span_1, true);
		var node = sibling(span_1, 2);

		{
			var consequent_1 = ($$anchor) => {
				var fragment = root_2$e();
				var span_2 = first_child(fragment);
				var text_2 = only_child(span_2, true);
				var node_1 = sibling(span_2, 2);

				{
					var consequent = ($$anchor) => {
						var div_3 = root_1$j();

						each(div_3, 21, () => get(chips), (chip) => chip.key, ($$anchor, chip) => {
							Tooltip($$anchor, {
								get text() {
									return get(chip).tooltip;
								},

								children: ($$anchor, $$slotProps) => {
									var span_3 = root$l();
									var text_3 = only_child(span_3, true);

									template_effect(() => set_text(text_3, get(chip).label));
									append($$anchor, span_3);
								},
								$$slots: { default: true }
							});
						});
						append($$anchor, div_3);
					};

					if_block(node_1, ($$render) => {
						if (get(chips).length > 0) $$render(consequent);
					});
				}

				template_effect(() => set_text(text_2, get(matchLine)));
				append($$anchor, fragment);
			};

			var alternate = ($$anchor) => {
				var fragment_2 = root_3$9();
				var span_4 = first_child(fragment_2);
				var text_4 = only_child(span_4, true);
				var span_5 = sibling(span_4, 2);
				var text_5 = only_child(span_5, true);

				template_effect(() => {
					set_attribute(span_4, 'title', get(content));
					set_text(text_4, get(content) || '—');
					set_text(text_5, get(whenLine));
				});

				append($$anchor, fragment_2);
			};

			if_block(node, ($$render) => {
				if (get(isAlgorithm)) $$render(consequent_1); else $$render(alternate, -1);
			});
		}

		var div_4 = sibling(node, 2);
		var node_2 = child(div_4);

		{
			var consequent_2 = ($$anchor) => {
				var button = root_4$5();
				var node_3 = child(button);

				Icon(node_3, { name: 'sliders', size: 16 });

				delegated('click', button, function (...$$args) {
					$$props.onSettings?.apply(this, $$args);
				});

				append($$anchor, button);
			};

			if_block(node_2, ($$render) => {
				if (get(isAlgorithm)) $$render(consequent_2);
			});
		}

		var button_1 = sibling(node_2, 2);
		var node_4 = child(button_1);

		Icon(node_4, { name: 'copy', size: 13 });

		var button_2 = sibling(button_1, 2);

		bind_this(button_2, ($$value) => set(menuButton, $$value), () => get(menuButton));

		template_effect(() => {
			classes = set_class(div, 1, `nested tone-${$$props.tone ?? ''}`, 'svelte-11qe3ec', classes, { selected: $$props.selected, 'two-line': get(isAlgorithm) });
			set_checked(input, $$props.selected);
			set_text(text, `Select ${get(badge) ?? ''}`);
			set_class(span_1, 1, `tag kind-${$$props.entry.kind ?? ''}`, 'svelte-11qe3ec');
			set_text(text_1, get(badge));
		});

		delegated('click', input, (event) => $$props.onSelect(event));

		delegated('click', button_1, function (...$$args) {
			$$props.onDuplicate?.apply(this, $$args);
		});

		delegated('click', button_2, () => get(menuButton) && $$props.onMenu(get(menuButton)));
		append($$anchor, div);
		pop();
	}

	delegate(['click']);

	var root$k = from_html(`<span class="badge target svelte-xhe0ze">Adding here</span>`);
	var root_1$i = from_html(`<span class="info svelte-xhe0ze"> </span>`);
	var root_2$d = from_html(`<button type="button" class="chip svelte-xhe0ze"> </button>`);
	var root_3$8 = from_html(`<button type="button" class="chip mode svelte-xhe0ze"> </button>`);
	var root_4$4 = from_html(`<button type="button" class="chip warn svelte-xhe0ze">No duplicates</button>`);
	var root_5$3 = from_html(`<div><div class="line one svelte-xhe0ze"><button type="button"><!></button> <label class="check svelte-xhe0ze"><input type="checkbox" class="svelte-xhe0ze"/> <span class="sr-only"> </span></label> <span class="name svelte-xhe0ze"> </span> <!> <!> <div class="actions svelte-xhe0ze"><button type="button" class="act svelte-xhe0ze" aria-label="Rule block settings" title="Rule block settings"><!></button> <button type="button" class="act svelte-xhe0ze" aria-label="Duplicate this rule block" title="Duplicate this rule block with its entries and settings. The copy goes directly below."><!></button> <button type="button" class="act svelte-xhe0ze" aria-label="More actions" title="More actions">⋯</button></div></div> <div class="line two svelte-xhe0ze"><button type="button" class="chip plays svelte-xhe0ze"> </button> <!> <!> <!> <!> <!> <!></div></div>`);

	const $$css$k = {
		hash: 'svelte-xhe0ze',
		code: '.head.svelte-xhe0ze {padding:9px 14px 10px;background:var(--tone-bg);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);border-left:3px solid var(--tone);}.tone-accent.svelte-xhe0ze {--tone: var(--accent);--tone-bg: rgba(91, 155, 245, 0.1);--tone-fg: var(--blue-fg);}.tone-violet.svelte-xhe0ze {--tone: var(--violet);--tone-bg: rgba(155, 124, 245, 0.1);--tone-fg: var(--violet-fg);}.tone-teal.svelte-xhe0ze {--tone: var(--teal);--tone-bg: rgba(52, 201, 163, 0.1);--tone-fg: var(--teal-fg);}.tone-amber.svelte-xhe0ze {--tone: var(--amber);--tone-bg: rgba(232, 163, 61, 0.1);--tone-fg: var(--amber-fg);}.tone-rose.svelte-xhe0ze {--tone: var(--rose);--tone-bg: rgba(229, 101, 138, 0.1);--tone-fg: var(--rose-fg);}.line.svelte-xhe0ze {display:flex;align-items:center;gap:8px;}.two.svelte-xhe0ze {gap:5px;margin-top:6px;flex-wrap:wrap;}.chev.svelte-xhe0ze {display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--text-3);cursor:pointer;transition:transform 120ms ease;transform:rotate(-90deg);}.chev.open.svelte-xhe0ze {transform:rotate(0deg);color:var(--tone-fg);}.check.svelte-xhe0ze {display:flex;align-items:center;}.check.svelte-xhe0ze input:where(.svelte-xhe0ze) {width:var(--qb-check);height:var(--qb-check);margin:0;accent-color:var(--accent);cursor:pointer;}.name.svelte-xhe0ze {font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);white-space:nowrap;}.badge.svelte-xhe0ze {display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:5px;font-size:var(--qb-text-xs);font-weight:700;letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;}.target.svelte-xhe0ze {background:rgba(91, 155, 245, 0.2);color:var(--blue-fg);}\n\n  /* Plain text: these counts are derived and cannot be set. */.info.svelte-xhe0ze {flex:1 1 0;min-width:0;font-size:var(--qb-text-sm);color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.actions.svelte-xhe0ze {flex:none;display:flex;align-items:center;gap:3px;}.act.svelte-xhe0ze {display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-4);font-size:17px;line-height:1;cursor:pointer;}.act.svelte-xhe0ze:hover {background:var(--bg-raised);color:var(--text);}.chip.svelte-xhe0ze {display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:6px;background:var(--chip-blue-bg);border:1px solid var(--chip-blue-line);color:var(--blue-fg);font-size:var(--qb-text-sm);font-weight:600;white-space:nowrap;cursor:pointer;}.chip.svelte-xhe0ze:hover {border-color:var(--line-strong);}.plays.svelte-xhe0ze {font-family:var(--font-mono);}.mode.svelte-xhe0ze {background:var(--chip-violet-bg);border-color:var(--chip-violet-line);color:var(--violet-fg);}.warn.svelte-xhe0ze {background:var(--chip-amber-bg);border-color:var(--chip-amber-line);color:var(--amber-fg);}'
	};

	function RuleBlockHeader($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$k);

		const infoLine = user_derived(() => `${$$props.info.uniqueAnime} anime · ${$$props.info.uniqueSongs} unique songs · ${$$props.chosen} chosen`);

		// The same three numbers in the wording of AMQ's popover.
		const infoTooltip = user_derived(() => t('quiz_builder.rule_block.popovers.block_info_content', `Song Count: ${$$props.chosen} · Unique Anime: ${$$props.info.uniqueAnime} · Unique Songs: ${$$props.info.uniqueSongs}`, {
			NUMBER: $$props.chosen,
			NUMBER2: $$props.info.uniqueAnime,
			NUMBER3: $$props.info.uniqueSongs
		}));

		const orderLabel = user_derived(() => $$props.block.randomOrder
			? t('quiz_builder.rule_block.order_rule.random', 'Random')
			: t('quiz_builder.rule_block.order_rule.sequential', 'Sequential'));

		const guessTimeLabel = user_derived(() => {
			const { guessTime, extraGuessTime } = $$props.block.guessTime;
			const extra = extraGuessTime === 0 ? '' : ` +${formatMaybeRandom(extraGuessTime)}s`;

			return `${formatMaybeRandom(guessTime)}s${extra}`;
		});

		const speedLabel = user_derived(() => Array.isArray($$props.block.playBackSpeed.playBackSpeed)
			? `${$$props.block.playBackSpeed.playBackSpeed.join('/')}×`
			: `${$$props.block.playBackSpeed.playBackSpeed}×`);

		let menuButton = state(null);
		var div = root_5$3();
		var div_1 = child(div);
		var button = child(div_1);
		let classes;
		var node = child(button);

		Icon(node, { name: 'caret', size: 15 });

		var label = sibling(button, 2);
		var input = child(label);

		var span = sibling(input, 2);
		var text = only_child(span);

		var span_1 = sibling(label, 2);
		var text_1 = only_child(span_1);
		var node_1 = sibling(span_1, 2);

		{
			var consequent = ($$anchor) => {
				Tooltip($$anchor, {
					text: 'Items you add from the library go to this block',
					children: ($$anchor, $$slotProps) => {
						var span_2 = root$k();

						append($$anchor, span_2);
					},
					$$slots: { default: true }
				});
			};

			if_block(node_1, ($$render) => {
				if ($$props.isTarget) $$render(consequent);
			});
		}

		var node_2 = sibling(node_1, 2);

		Tooltip(node_2, {
			get text() {
				return get(infoTooltip);
			},
			wide: true,
			children: ($$anchor, $$slotProps) => {
				var span_3 = root_1$i();
				var text_2 = only_child(span_3, true);

				template_effect(() => set_text(text_2, get(infoLine)));
				append($$anchor, span_3);
			},
			$$slots: { default: true }
		});

		var div_2 = sibling(node_2, 2);
		var button_1 = child(div_2);
		var node_3 = child(button_1);

		Icon(node_3, { name: 'sliders', size: 17 });

		var button_2 = sibling(button_1, 2);
		var node_4 = child(button_2);

		Icon(node_4, { name: 'copy', size: 14 });

		var button_3 = sibling(button_2, 2);

		bind_this(button_3, ($$value) => set(menuButton, $$value), () => get(menuButton));

		var div_3 = sibling(div_1, 2);
		var button_4 = child(div_3);
		var text_3 = only_child(button_4);
		var node_5 = sibling(button_4, 2);

		{
			let $0 = user_derived(() => t('quiz_builder.rule_block.order_rule.description', 'The order songs are selected from this block'));

			Tooltip(node_5, {
				get text() {
					return get($0);
				},

				children: ($$anchor, $$slotProps) => {
					var button_5 = root_2$d();
					var text_4 = only_child(button_5, true);

					template_effect(() => set_text(text_4, get(orderLabel)));

					delegated('click', button_5, function (...$$args) {
						$$props.onToggleOrder?.apply(this, $$args);
					});

					append($$anchor, button_5);
				},
				$$slots: { default: true }
			});
		}

		var node_6 = sibling(node_5, 2);

		{
			let $0 = user_derived(() => t('quiz_builder.rule_block.popovers.guess_time_description', 'The default guess time for songs in this block'));

			Tooltip(node_6, {
				get text() {
					return get($0);
				},

				children: ($$anchor, $$slotProps) => {
					var button_6 = root_2$d();
					var text_5 = only_child(button_6, true);

					template_effect(() => set_text(text_5, get(guessTimeLabel)));

					delegated('click', button_6, function (...$$args) {
						$$props.onSettings?.apply(this, $$args);
					});

					append($$anchor, button_6);
				},
				$$slots: { default: true }
			});
		}

		var node_7 = sibling(node_6, 2);

		{
			let $0 = user_derived(() => t('quiz_builder.rule_block.popovers.sample_point_description', 'The default sample point for songs in this block'));

			Tooltip(node_7, {
				get text() {
					return get($0);
				},

				children: ($$anchor, $$slotProps) => {
					var button_7 = root_2$d();
					var text_6 = only_child(button_7);

					template_effect(($0) => set_text(text_6, `Sample ${$0 ?? ''}%`), [
						() => formatMaybeRandom($$props.block.samplePoint.samplePoint)
					]);

					delegated('click', button_7, function (...$$args) {
						$$props.onSettings?.apply(this, $$args);
					});

					append($$anchor, button_7);
				},
				$$slots: { default: true }
			});
		}

		var node_8 = sibling(node_7, 2);

		{
			let $0 = user_derived(() => t('quiz_builder.rule_block.popovers.playback_speed_description', 'The default playback speed for songs in this block'));

			Tooltip(node_8, {
				get text() {
					return get($0);
				},

				children: ($$anchor, $$slotProps) => {
					var button_8 = root_2$d();
					var text_7 = only_child(button_8, true);

					template_effect(() => set_text(text_7, get(speedLabel)));

					delegated('click', button_8, function (...$$args) {
						$$props.onSettings?.apply(this, $$args);
					});

					append($$anchor, button_8);
				},
				$$slots: { default: true }
			});
		}

		var node_9 = sibling(node_8, 2);

		{
			var consequent_1 = ($$anchor) => {
				{
					let $0 = user_derived(() => t('quiz_builder.rule_block.popovers.guess_mode_description', 'The default guess modes for songs in this block'));

					Tooltip($$anchor, {
						get text() {
							return get($0);
						},

						children: ($$anchor, $$slotProps) => {
							var button_9 = root_3$8();
							var text_8 = only_child(button_9, true);

							template_effect(($0) => set_text(text_8, $0), [() => guessModeNames($$props.block.guessModes).join(' · ')]);

							delegated('click', button_9, function (...$$args) {
								$$props.onSettings?.apply(this, $$args);
							});

							append($$anchor, button_9);
						},
						$$slots: { default: true }
					});
				}
			};

			var d = user_derived(() => !isSongOnly($$props.block.guessModes));

			if_block(node_9, ($$render) => {
				if (get(d)) $$render(consequent_1);
			});
		}

		var node_10 = sibling(node_9, 2);

		{
			var consequent_2 = ($$anchor) => {
				{
					let $0 = user_derived(() => t('quiz_builder.rule_block.popovers.allow_duplicates', 'Allow duplicate shows to be selected from this block'));

					Tooltip($$anchor, {
						get text() {
							return get($0);
						},

						children: ($$anchor, $$slotProps) => {
							var button_10 = root_4$4();

							delegated('click', button_10, function (...$$args) {
								$$props.onSettings?.apply(this, $$args);
							});

							append($$anchor, button_10);
						},
						$$slots: { default: true }
					});
				}
			};

			if_block(node_10, ($$render) => {
				if (!$$props.block.duplicates) $$render(consequent_2);
			});
		}

		template_effect(
			($0, $1) => {
				set_class(div, 1, `head tone-${$$props.tone ?? ''}`, 'svelte-xhe0ze');
				classes = set_class(button, 1, 'chev svelte-xhe0ze', null, classes, { open: !$$props.collapsed });
				set_attribute(button, 'aria-expanded', !$$props.collapsed);
				set_attribute(button, 'aria-label', $$props.collapsed ? 'Expand this block' : 'Collapse this block');
				set_checked(input, $$props.allSelected);
				set_text(text, `Select everything in rule block ${$$props.position ?? ''}`);

				set_text(text_1, `${$0 ?? ''}
      ${$$props.position ?? ''}`);

				set_text(text_3, `${$1 ?? ''}
      ${$$props.block.songCount ?? ''}`);
			},
			[
				() => t('quiz_builder.rule_block.title', 'Rule Block'),
				() => t('quiz_builder.rule_block.song_count.label', 'Song Count')
			]
		);

		delegated('click', button, function (...$$args) {
			$$props.onToggleCollapse?.apply(this, $$args);
		});

		delegated('change', input, (event) => $$props.onSelectAll(event.currentTarget.checked));

		delegated('click', button_1, function (...$$args) {
			$$props.onSettings?.apply(this, $$args);
		});

		delegated('click', button_2, function (...$$args) {
			$$props.onDuplicate?.apply(this, $$args);
		});

		delegated('click', button_3, () => get(menuButton) && $$props.onMenu(get(menuButton)));

		delegated('click', button_4, function (...$$args) {
			$$props.onSettings?.apply(this, $$args);
		});

		append($$anchor, div);
		pop();
	}

	delegate(['click', 'change']);

	var root$j = from_html(`<div class="drop-line svelte-1kq0xj3"><span class="drop-count svelte-1kq0xj3"> </span></div>`);
	var root_1$h = from_html(`<div class="row-host svelte-1kq0xj3" role="presentation"><!> <!></div>`);
	var root_2$c = from_html(`<span class="hint svelte-1kq0xj3"> </span>`);
	var root_3$7 = from_html(`<button type="button" class="add-nested svelte-1kq0xj3"><!> </button>`);
	var root_4$3 = from_html(`<div role="presentation"><!> <span class="add-label svelte-1kq0xj3">Add to this block:</span> <!> <span class="rule svelte-1kq0xj3">no rule block inside a rule block</span></div>`);
	var root_5$2 = from_html(`<p class="empty svelte-1kq0xj3">This quiz has no blocks yet.</p>`);
	var root_6$1 = from_html(`<section class="pane svelte-1kq0xj3"><header class="band svelte-1kq0xj3"><h2 class="title svelte-1kq0xj3"> </h2> <span class="count mono svelte-1kq0xj3"> </span> <label class="search svelte-1kq0xj3"><!> <input id="amq-ui-quiz-search" type="search" placeholder="Search this quiz" class="svelte-1kq0xj3"/></label> <button type="button" class="add-block svelte-1kq0xj3"><!> </button></header> <div class="list svelte-1kq0xj3"></div></section>`);

	const $$css$j = {
		hash: 'svelte-1kq0xj3',
		code: '.pane.svelte-1kq0xj3 {flex:1 1 62%;min-width:0;display:flex;flex-direction:column;background:var(--bg-list);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;}.band.svelte-1kq0xj3 {flex:none;display:flex;align-items:center;gap:10px;height:var(--qb-band-h);padding:0 14px;background:var(--bg-head);border-bottom:1px solid var(--line);}.title.svelte-1kq0xj3 {margin:0;font-family:var(--font-display);font-size:16px;font-weight:700;}.count.svelte-1kq0xj3 {font-size:var(--qb-text-sm);color:var(--text-4);}.search.svelte-1kq0xj3 {flex:1 1 0;min-width:0;display:flex;align-items:center;gap:6px;height:34px;padding:0 11px;border-radius:8px;background:var(--bg-sunken);border:1px solid var(--line-soft);color:var(--text-4);}.search.svelte-1kq0xj3 input:where(.svelte-1kq0xj3) {flex:1 1 0;min-width:0;border:0;background:transparent;color:var(--text);font-family:inherit;font-size:var(--qb-text);outline:none;}.add-block.svelte-1kq0xj3 {display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 14px;border:0;border-radius:8px;background:var(--accent);color:var(--accent-fg);font-size:var(--qb-text);font-weight:700;white-space:nowrap;cursor:pointer;}.add-block.svelte-1kq0xj3:disabled {background:var(--bg-raised);color:var(--text-5);cursor:default;}.list.svelte-1kq0xj3 {flex:1 1 0;overflow-y:auto;overflow-x:hidden;}\n\n  /* Positions the drop line against its row. */.row-host.svelte-1kq0xj3 {position:relative;}.drop-line.svelte-1kq0xj3 {position:absolute;top:-1px;left:14px;right:12px;z-index:2;height:2px;background:var(--accent);border-radius:1px;}\n\n  /* Shows how many rows the drag carries. */.drop-count.svelte-1kq0xj3 {position:absolute;top:-8px;left:-6px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--accent);color:var(--accent-fg);font-family:var(--font-mono);font-size:9.5px;font-weight:700;line-height:16px;text-align:center;}.footer.svelte-1kq0xj3 {display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:9px 14px 11px calc(var(--qb-check-x) + 4px);border-bottom:1px solid var(--line);}\n\n  /* A drop here appends to the block, so the whole zone is highlighted. */.drop-into.svelte-1kq0xj3 {background:rgba(91, 155, 245, 0.12);outline:1px dashed var(--accent);outline-offset:-3px;}.hint.svelte-1kq0xj3 {flex-basis:100%;font-size:var(--qb-text-sm);color:var(--text-5);}.add-label.svelte-1kq0xj3 {font-size:var(--qb-text-xs);color:var(--text-4);}.add-nested.svelte-1kq0xj3 {display:inline-flex;align-items:center;gap:4px;height:27px;padding:0 10px;border-radius:6px;background:var(--bg-raised);border:1px solid var(--line-soft);color:var(--text-2);font-size:var(--qb-text-sm);font-weight:600;cursor:pointer;}.add-nested.svelte-1kq0xj3:hover:not(:disabled) {border-color:var(--line-strong);color:var(--text);}.add-nested.svelte-1kq0xj3:disabled {opacity:0.45;cursor:default;}.rule.svelte-1kq0xj3 {margin-left:auto;font-size:var(--qb-text-xs);color:var(--text-5);font-style:italic;}.empty.svelte-1kq0xj3 {padding:24px;text-align:center;color:var(--text-4);}'
	};

	function QuizList($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$j);

		let search = state('');
		let collapsed = state(proxy(new Set()));

		/** The start of a shift-click range. */
		let lastClicked = null;

		/**
		 * Quiz-pane search. Entries hold ids, so names resolve through the library.
		 */
		function matches(entry) {
			const needle = get(search).trim().toLowerCase();

			if (!needle) return true;

			if (entry.kind === 'anime') {
				return describeAnime(entry.annId).name.toLowerCase().includes(needle);
			}

			if (entry.kind === 'song') {
				const song = describeSong(entry.annSongId);

				return song.title.toLowerCase().includes(needle) || song.artist.toLowerCase().includes(needle) || song.animeName.toLowerCase().includes(needle);
			}

			if (entry.kind === 'message') return entry.message.toLowerCase().includes(needle);
			if (entry.kind === 'title') return entry.title.toLowerCase().includes(needle);

			// An algorithm block has no text to match.
			return false;
		}

		const rows = user_derived(() => buildRows(quizStore.quiz, {
			collapsed: get(collapsed),
			targetBlockId: quizStore.targetBlockId,
			matches: get(search).trim() ? matches : undefined
		}));

		function toggleCollapse(blockId) {
			const next = new Set(get(collapsed));

			if (next.has(blockId)) next.delete(blockId); else next.add(blockId);

			set(collapsed, next, true);
		}

		/** Shift extends from the last plain click. A plain click starts a new range. */
		function select(id, event) {
			if (event.shiftKey && lastClicked) {
				quizStore.selectRange(lastClicked, id);

				return;
			}

			quizStore.toggleSelected(id);
			lastClicked = id;
		}

		function blockAllSelected(blockId) {
			const block = quizStore.quiz.blocks.find((item) => item.id === blockId);

			if (!block || block.entries.length === 0) return false;

			return block.entries.every((entry) => quizStore.selection.has(entry.id));
		}

		/**
		 * Sets the drop target from the pointer's position in a row.
		 *
		 * The top half inserts before the row and the bottom half after it. The row
		 * under the pointer is measured, because rows have different heights:
		 * nested blocks are taller than entries.
		 */
		function hover(event, blockId, index) {
			if (!dragState.active) return;

			event.preventDefault();

			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

			const box = event.currentTarget.getBoundingClientRect();
			const after = event.clientY > box.top + box.height / 2;

			dragState.enter({ blockId, index: after ? index + 1 : index });
		}

		/** A drop on a block's footer appends to that block. */
		function hoverEnd(event, blockId) {
			if (!dragState.active) return;

			event.preventDefault();

			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

			dragState.enter({ blockId, index: -1 });
		}

		function indicatorAt(blockId, index) {
			const over = dragState.over;

			return over?.blockId === blockId && over.index === index;
		}

		function addNested(blockId, kind) {
			if (kind === 'message') {
				quizStore.addEntry(
					{
						kind: 'message',
						connectUp: false,
						locked: false,
						message: '',
						avatar: null,
						videoDisplay: false,
						delay: 0,
						time: 5
					},
					blockId
				);

				return;
			}

			if (kind === 'title') {
				quizStore.addEntry({ kind: 'title', connectUp: false, locked: false, title: '' }, blockId);

				return;
			}

			// AMQ's dialog creates the algorithm block. Set the target block here;
			// the caller opens the dialog.
			quizStore.targetBlockId = blockId;

			$$props.onAlgorithmSettings('');
		}

		var section = root_6$1();
		var header = child(section);
		var h2 = child(header);
		var text = only_child(h2, true);
		var span = sibling(h2, 2);
		var text_1 = only_child(span);
		var label = sibling(span, 2);
		var node = child(label);

		Icon(node, { name: 'search', size: 15 });

		var input = sibling(node, 2);

		var button = sibling(label, 2);
		var node_1 = child(button);

		Icon(node_1, { name: 'plus', size: 15 });

		var text_2 = sibling(node_1);

		var div = sibling(header, 2);

		each(
			div,
			21,
			() => get(rows),
			(row) => row.id,
			($$anchor, row) => {
				var fragment = comment();
				var node_2 = first_child(fragment);

				{
					var consequent = ($$anchor) => {
						{
							let $0 = user_derived(() => quizStore.info(get(row).block));
							let $1 = user_derived(() => quizStore.chosen(get(row).block));
							let $2 = user_derived(() => get(collapsed).has(get(row).block.id));
							let $3 = user_derived(() => blockAllSelected(get(row).block.id));

							RuleBlockHeader($$anchor, {
								get block() {
									return get(row).block;
								},

								get position() {
									return get(row).position;
								},

								get tone() {
									return get(row).tone;
								},

								get info() {
									return get($0);
								},

								get chosen() {
									return get($1);
								},

								get collapsed() {
									return get($2);
								},

								get isTarget() {
									return get(row).isTarget;
								},

								get allSelected() {
									return get($3);
								},
								onToggleCollapse: () => toggleCollapse(get(row).block.id),
								onSelectAll: (on) => quizStore.selectBlock(get(row).block.id, on),
								onToggleOrder: () => quizStore.updateBlock(get(row).block.id, { randomOrder: !get(row).block.randomOrder }),
								onSettings: () => $$props.onBlockSettings(get(row).block.id),
								onDuplicate: () => quizStore.duplicateRuleBlock(get(row).block.id),
								onMenu: (anchor) => $$props.onMenu(anchor, 'block', get(row).block.id)
							});
						}
					};

					var consequent_2 = ($$anchor) => {
						var div_1 = root_1$h();
						var node_3 = child(div_1);

						{
							var consequent_1 = ($$anchor) => {
								var div_2 = root$j();
								var span_1 = child(div_2);
								var text_3 = only_child(span_1, true);
								template_effect(() => set_text(text_3, dragState.count));
								append($$anchor, div_2);
							};

							var d = user_derived(() => indicatorAt(get(row).block.id, get(row).indexInBlock));

							if_block(node_3, ($$render) => {
								if (get(d)) $$render(consequent_1);
							});
						}

						var node_4 = sibling(node_3, 2);

						{
							let $0 = user_derived(() => quizStore.pool(get(row).entry));
							let $1 = user_derived(() => quizStore.selection.has(get(row).entry.id));

							EntryRow(node_4, {
								get entry() {
									return get(row).entry;
								},

								get pool() {
									return get($0);
								},

								get selected() {
									return get($1);
								},

								get canChainUp() {
									return get(row).canChainUp;
								},

								get chainedUp() {
									return get(row).chainedUp;
								},

								get chainedDown() {
									return get(row).chainedDown;
								},
								onSelect: (event) => select(get(row).entry.id, event),
								onToggleChain: () => quizStore.toggleChain(get(row).entry.id),
								onToggleType: (type) => quizStore.toggleSongType(get(row).entry.id, type),
								onPick: (value) => quizStore.setNumberOfSongs(get(row).entry.id, value),
								onToggleLock: () => quizStore.toggleLock(get(row).entry.id),
								onSettings: () => $$props.onEntrySettings(get(row).entry.id),
								onMenu: (anchor) => $$props.onMenu(anchor, 'entry', get(row).entry.id),
								onDragStart: () => dragState.start(get(row).entry.id),
								onDragEnd: () => dragState.cancel()
							});
						}
						event('dragover', div_1, (event) => hover(event, get(row).block.id, get(row).indexInBlock));

						event('drop', div_1, (event) => {
							event.preventDefault();
							dragState.drop();
						});

						append($$anchor, div_1);
					};

					var consequent_3 = ($$anchor) => {
						{
							let $0 = user_derived(() => quizStore.selection.has(get(row).entry.id));

							NestedBlock($$anchor, {
								get entry() {
									return get(row).entry;
								},

								get tone() {
									return get(row).tone;
								},

								get selected() {
									return get($0);
								},
								onSelect: (event) => select(get(row).entry.id, event),
								onSettings: () => $$props.onAlgorithmSettings(get(row).entry.id),
								onDuplicate: () => quizStore.duplicateEntries([get(row).entry.id]),
								onMenu: (anchor) => $$props.onMenu(anchor, 'entry', get(row).entry.id)
							});
						}
					};

					var alternate = ($$anchor) => {
						var div_3 = root_4$3();
						let classes;
						var node_5 = child(div_3);

						{
							var consequent_4 = ($$anchor) => {
								var span_2 = root_2$c();
								var text_4 = only_child(span_2, true);

								template_effect(($0) => set_text(text_4, $0), [
									() => t('quiz_builder.rule_block.tutorial_text', 'Add anime or songs from the library to fill this block')
								]);

								append($$anchor, span_2);
							};

							if_block(node_5, ($$render) => {
								if (get(row).empty) $$render(consequent_4);
							});
						}

						var node_6 = sibling(node_5, 4);

						each(
							node_6,
							16,
							() => [
								{ kind: 'algorithm', label: 'Algorithm' },
								{ kind: 'message', label: 'Message' },
								{ kind: 'title', label: 'Title' }
							],
							(option) => option.kind,
							($$anchor, option) => {
								const blocked = user_derived(() => quizStore.capReached(option.kind));
								var button_1 = root_3$7();
								var node_7 = child(button_1);

								Icon(node_7, { name: 'plus', size: 13 });

								var text_5 = sibling(node_7);

								template_effect(
									($0) => {
										button_1.disabled = get(blocked) !== null;
										set_attribute(button_1, 'title', $0);
										set_text(text_5, ` ${option.label ?? ''}`);
									},
									[
										() => get(blocked) ?? `Add a ${option.label.toLowerCase()} block`
									]
								);

								delegated('click', button_1, () => addNested(get(row).block.id, option.kind));
								append($$anchor, button_1);
							}
						);

						template_effect(() => classes = set_class(div_3, 1, 'footer svelte-1kq0xj3', null, classes, {
							'drop-into': dragState.active && dragState.over?.blockId === get(row).block.id && dragState.over.index === -1
						}));

						event('dragover', div_3, (event) => hoverEnd(event, get(row).block.id));

						event('drop', div_3, (event) => {
							event.preventDefault();
							dragState.drop();
						});

						append($$anchor, div_3);
					};

					if_block(node_2, ($$render) => {
						if (get(row).kind === 'block') $$render(consequent); else if (get(row).kind === 'entry') $$render(consequent_2, 1); else if (get(row).kind === 'nested') $$render(consequent_3, 2); else $$render(alternate, -1);
					});
				}

				append($$anchor, fragment);
			},
			($$anchor) => {
				var p = root_5$2();

				append($$anchor, p);
			}
		);

		template_effect(
			($0, $1, $2, $3) => {
				set_text(text, $0);
				set_text(text_1, `${quizStore.entryCount ?? ''} entries`);
				button.disabled = $1;
				set_attribute(button, 'title', $2);
				set_text(text_2, ` ${$3 ?? ''}`);
			},
			[
				() => t('quiz_builder.title', 'Quiz'),
				() => quizStore.capReached('rule') !== null,
				() => quizStore.capReached('rule') ?? 'Add a rule block',
				() => t('quiz_builder.rule_button.title', 'Add rule block')
			]
		);

		bind_value(input, () => get(search), ($$value) => set(search, $$value));
		delegated('click', button, () => quizStore.addRuleBlock());
		append($$anchor, section);
		pop();
	}

	delegate(['click']);

	var root$i = from_html(`<button type="button" class="item svelte-t9u46n">Move to…</button> <button type="button" class="item svelte-t9u46n">Duplicate</button> <button type="button" class="item svelte-t9u46n">Lock or unlock</button> <div class="sep svelte-t9u46n"></div> <button type="button" class="item danger svelte-t9u46n">Remove</button>`, 1);
	var root_1$g = from_html(`<button type="button" class="item svelte-t9u46n">Duplicate block</button> <button type="button" class="item svelte-t9u46n">Add library items here</button> <button type="button" class="item svelte-t9u46n">Select all entries</button> <div class="sep svelte-t9u46n"></div> <button type="button" class="item danger svelte-t9u46n"> </button>`, 1);
	var root_2$b = from_html(`<div class="menu svelte-t9u46n"><button type="button" class="item svelte-t9u46n">Settings</button> <!></div>`);

	const $$css$i = {
		hash: 'svelte-t9u46n',
		code: '.menu.svelte-t9u46n {display:flex;flex-direction:column;gap:1px;padding:5px;}.item.svelte-t9u46n {width:100%;height:28px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--text-2);font-family:inherit;font-size:12px;text-align:left;cursor:pointer;}.item.svelte-t9u46n:hover:not(:disabled) {background:var(--bg-raised);color:var(--text);}.item.svelte-t9u46n:disabled {opacity:0.4;cursor:default;}.danger.svelte-t9u46n:hover:not(:disabled) {background:var(--chip-rose-bg);color:var(--rose-fg);}.sep.svelte-t9u46n {height:1px;margin:4px 2px;background:var(--line);}'
	};

	function RowMenu($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$i);

		const isLastBlock = user_derived(() => $$props.kind === 'block' && quizStore.quiz.blocks.length <= 1);

		function act(run) {
			run();
			$$props.onDismiss();
		}

		Floating($$anchor, {
			get anchor() {
				return $$props.anchor;
			},
			placement: 'below',
			align: 'end',
			width: 200,
			get onDismiss() {
				return $$props.onDismiss;
			},

			children: ($$anchor, $$slotProps) => {
				var div = root_2$b();
				var button = child(div);
				var node = sibling(button, 2);

				{
					var consequent = ($$anchor) => {
						var fragment_1 = root$i();
						var button_1 = first_child(fragment_1);
						var button_2 = sibling(button_1, 2);
						var button_3 = sibling(button_2, 2);
						var button_4 = sibling(button_3, 4);

						delegated('click', button_1, () => {
							// A row's own menu acts on that row, whatever the selection was.
							quizStore.clearSelection();

							quizStore.toggleSelected($$props.id);
							$$props.onMove($$props.anchor);
						});

						delegated('click', button_2, () => act(() => quizStore.duplicateEntries([$$props.id])));
						delegated('click', button_3, () => act(() => quizStore.toggleLock($$props.id)));
						delegated('click', button_4, () => act(() => quizStore.removeEntries([$$props.id])));
						append($$anchor, fragment_1);
					};

					var alternate = ($$anchor) => {
						var fragment_2 = root_1$g();
						var button_5 = first_child(fragment_2);
						var button_6 = sibling(button_5, 2);
						var button_7 = sibling(button_6, 2);
						var button_8 = sibling(button_7, 4);
						var text = only_child(button_8);

						template_effect(
							($0, $1) => {
								button_8.disabled = get(isLastBlock);
								set_attribute(button_8, 'title', $0);
								set_text(text, `${$1 ?? ''} block`);
							},
							[
								() => get(isLastBlock)
									? t('quiz_builder.rule_block.cannot_delete_message.description', 'At least one rule block must exist in the quiz')
									: undefined,
								() => t('quiz_builder.rule_block.delete_message.confirm', 'Delete')
							]
						);

						delegated('click', button_5, () => act(() => quizStore.duplicateRuleBlock($$props.id)));
						delegated('click', button_6, () => act(() => quizStore.targetBlockId = $$props.id));
						delegated('click', button_7, () => act(() => quizStore.selectBlock($$props.id, true)));
						delegated('click', button_8, () => act(() => quizStore.removeRuleBlock($$props.id)));
						append($$anchor, fragment_2);
					};

					if_block(node, ($$render) => {
						if ($$props.kind === 'entry') $$render(consequent); else $$render(alternate, -1);
					});
				}

				delegated('click', button, function (...$$args) {
					$$props.onSettings?.apply(this, $$args);
				});

				append($$anchor, div);
			},
			$$slots: { default: true }
		});

		pop();
	}

	delegate(['click']);

	var root$h = from_html(`<button type="button"> </button>`);
	var root_1$f = from_html(`<p class="note svelte-93uu5z"> </p>`);
	var root_2$a = from_html(`<div class="field svelte-93uu5z"><span class="label svelte-93uu5z"> </span> <div class="tags svelte-93uu5z"></div> <!></div>`);
	var root_3$6 = from_html(`<p class="error svelte-93uu5z"> </p>`);
	var root_4$2 = from_html(`<div class="scrim svelte-93uu5z" role="presentation"></div> <div class="panel svelte-93uu5z" role="dialog" aria-label="Save quiz"><header class="head svelte-93uu5z"><h2 class="svelte-93uu5z"> </h2> <button type="button" class="close svelte-93uu5z" aria-label="Close"><!></button></header> <div class="body svelte-93uu5z"><label class="field svelte-93uu5z"><span class="label svelte-93uu5z"> </span> <input type="text" maxlength="50" class="svelte-93uu5z"/></label> <label class="field svelte-93uu5z"><span class="label svelte-93uu5z"> </span> <textarea rows="3" maxlength="200" class="svelte-93uu5z"></textarea></label> <!> <!></div> <footer class="foot svelte-93uu5z"><button type="button" class="quiet svelte-93uu5z"> </button> <span class="spacer svelte-93uu5z"></span> <button type="button" class="save svelte-93uu5z"> </button></footer></div>`, 1);

	const $$css$h = {
		hash: 'svelte-93uu5z',
		code: '.scrim.svelte-93uu5z {position:fixed;inset:0;z-index:20;background:rgba(0, 0, 0, 0.45);}.panel.svelte-93uu5z {position:fixed;top:50%;left:50%;z-index:21;transform:translate(-50%, -50%);width:420px;display:flex;flex-direction:column;border-radius:10px;background:var(--bg-pop);border:1px solid var(--line-strong);box-shadow:0 18px 50px rgba(0, 0, 0, 0.5);}.head.svelte-93uu5z {display:flex;align-items:center;height:46px;padding:0 14px;border-bottom:1px solid var(--line);}.head.svelte-93uu5z h2:where(.svelte-93uu5z) {flex:1 1 0;margin:0;font-family:var(--font-display);font-size:14px;font-weight:700;}.close.svelte-93uu5z {display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-4);cursor:pointer;}.body.svelte-93uu5z {padding:14px;}.field.svelte-93uu5z {display:block;margin-bottom:14px;}.label.svelte-93uu5z {display:block;margin-bottom:6px;font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-4);}input.svelte-93uu5z,\n  textarea.svelte-93uu5z {width:100%;padding:7px 9px;border-radius:7px;background:var(--bg-sunken);border:1px solid var(--line-strong);color:var(--text);font-family:inherit;font-size:12.5px;resize:vertical;outline:none;}input.svelte-93uu5z:focus,\n  textarea.svelte-93uu5z:focus {border-color:var(--accent);}.tags.svelte-93uu5z {display:flex;flex-wrap:wrap;gap:5px;}.tag.svelte-93uu5z {height:26px;padding:0 10px;border-radius:6px;background:transparent;border:1px dashed var(--chip-off-line);color:var(--chip-off-fg);font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer;}.tag.on.svelte-93uu5z {background:var(--chip-blue-bg);border:1px solid var(--chip-blue-line);color:var(--blue-fg);}.tag.svelte-93uu5z:disabled {opacity:0.4;cursor:default;}.note.svelte-93uu5z {margin:8px 0 0;font-size:11px;color:var(--text-5);}.error.svelte-93uu5z {margin:4px 0 0;font-size:11.5px;color:var(--rose-fg);}.foot.svelte-93uu5z {display:flex;align-items:center;gap:8px;height:54px;padding:0 14px;border-top:1px solid var(--line);}.spacer.svelte-93uu5z {flex:1 1 0;}.quiet.svelte-93uu5z {height:30px;padding:0 12px;border-radius:7px;background:transparent;border:1px solid var(--line-soft);color:var(--text-3);font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;}.save.svelte-93uu5z {height:30px;padding:0 16px;border:0;border-radius:7px;background:var(--accent);color:var(--accent-fg);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;}.save.svelte-93uu5z:disabled {opacity:0.5;cursor:default;}'
	};

	function SaveDialog($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$h);

		/** Tags from AMQ's tag component. Empty if the component is not built yet. */
		const tags = user_derived(() => {
			try {
				const map = customQuizCreator?.tagContainer?.tagMap;

				if (!map) return [];

				return Object.values(map).map((tag) => ({ id: tag.tagId, name: tag.name }));
			} catch {
				return [];
			}
		});

		const selected = user_derived(() => quizStore.quiz.tags ?? []);
		const atCap = user_derived(() => get(selected).length >= MAX_TAGS);

		function toggleTag(id) {
			const current = quizStore.quiz.tags;
			const index = current.indexOf(id);

			if (index !== -1) {
				current.splice(index, 1);

				return;
			}

			if (current.length >= MAX_TAGS) return;

			current.push(id);
		}

		function save() {
			quizStore.save();
		}

		user_effect(() => {
			if (quizStore.saveState === 'saved') $$props.onClose();
		});

		var fragment = root_4$2();
		var div = first_child(fragment);
		var div_1 = sibling(div, 2);
		var header = child(div_1);
		var h2 = child(header);
		var text = only_child(h2, true);
		var button = sibling(h2, 2);
		var node = child(button);

		Icon(node, { name: 'close', size: 14 });

		var div_2 = sibling(header, 2);
		var label = child(div_2);
		var span = child(label);
		var text_1 = only_child(span, true);
		var input = sibling(span, 2);

		var label_1 = sibling(label, 2);
		var span_1 = child(label_1);
		var text_2 = only_child(span_1, true);
		var textarea = sibling(span_1, 2);

		var node_1 = sibling(label_1, 2);

		{
			var consequent_1 = ($$anchor) => {
				var div_3 = root_2$a();
				var span_2 = child(div_3);
				var text_3 = only_child(span_2, true);
				var div_4 = sibling(span_2, 2);

				each(div_4, 21, () => get(tags), (tag) => tag.id, ($$anchor, tag) => {
					const on = user_derived(() => get(selected).includes(get(tag).id));
					var button_1 = root$h();
					let classes;
					var text_4 = only_child(button_1, true);

					template_effect(() => {
						classes = set_class(button_1, 1, 'tag svelte-93uu5z', null, classes, { on: get(on) });
						set_attribute(button_1, 'aria-pressed', get(on));
						button_1.disabled = !get(on) && get(atCap);
						set_text(text_4, get(tag).name);
					});

					delegated('click', button_1, () => toggleTag(get(tag).id));
					append($$anchor, button_1);
				});

				var node_2 = sibling(div_4, 2);

				{
					var consequent = ($$anchor) => {
						var p = root_1$f();
						var text_5 = only_child(p, true);

						template_effect(($0) => set_text(text_5, $0), [
							() => t('quiz_builder.save_window.tags_max_warning', 'Max 2 tags allowed')
						]);

						append($$anchor, p);
					};

					if_block(node_2, ($$render) => {
						if (get(atCap)) $$render(consequent);
					});
				}
				template_effect(($0) => set_text(text_3, $0), [() => t('quiz_builder.save_window.tags', 'Tags')]);
				append($$anchor, div_3);
			};

			var consequent_2 = ($$anchor) => {
				var p_1 = root_1$f();
				var text_6 = only_child(p_1);

				template_effect(() => set_text(text_6, `This quiz has ${get(selected).length ?? ''}
        ${get(selected).length === 1 ? 'tag' : 'tags'}. The save keeps them.`));

				append($$anchor, p_1);
			};

			if_block(node_1, ($$render) => {
				if (get(tags).length > 0) $$render(consequent_1); else if (get(selected).length > 0) $$render(consequent_2, 1);
			});
		}

		var node_3 = sibling(node_1, 2);

		{
			var consequent_3 = ($$anchor) => {
				var p_2 = root_3$6();
				var text_7 = only_child(p_2, true);

				template_effect(($0) => set_text(text_7, $0), [
					() => t('quiz_builder.alerts.save_failed.description', 'An error occurred while trying to save your quiz. Please try again later.')
				]);

				append($$anchor, p_2);
			};

			if_block(node_3, ($$render) => {
				if (quizStore.saveState === 'failed') $$render(consequent_3);
			});
		}

		var footer = sibling(div_2, 2);
		var button_2 = child(footer);
		var text_8 = only_child(button_2, true);
		var button_3 = sibling(button_2, 4);
		var text_9 = only_child(button_3, true);

		template_effect(
			($0, $1, $2, $3, $4, $5, $6) => {
				set_text(text, $0);
				set_text(text_1, $1);
				set_text(text_2, $2);
				set_attribute(textarea, 'placeholder', $3);
				set_text(text_8, $4);
				button_3.disabled = $5;
				set_text(text_9, $6);
			},
			[
				() => t('quiz_builder.save_window.title', 'Save Quiz'),
				() => t('quiz_builder.quiz_name', 'Quiz Name'),
				() => t('quiz_builder.save_window.description.title', 'Description'),
				() => t('quiz_builder.save_window.description.placeholder', 'Enter a description for your quiz'),
				() => t('common.ui.cancel_button', 'Cancel'),
				() => !quizStore.quiz.name.trim() || quizStore.saveState === 'saving',
				() => quizStore.saveState === 'saving'
					? t('quiz_builder.save_window.saving', 'Saving')
					: t('quiz_builder.save_window.save_button', 'Save')
			]
		);

		delegated('click', div, function (...$$args) {
			$$props.onClose?.apply(this, $$args);
		});

		delegated('click', button, function (...$$args) {
			$$props.onClose?.apply(this, $$args);
		});

		bind_value(input, () => quizStore.quiz.name, ($$value) => quizStore.quiz.name = $$value);
		bind_value(textarea, () => quizStore.quiz.description, ($$value) => quizStore.quiz.description = $$value);

		delegated('click', button_2, function (...$$args) {
			$$props.onClose?.apply(this, $$args);
		});

		delegated('click', button_3, save);
		append($$anchor, fragment);
		pop();
	}

	delegate(['click']);

	var root$g = from_html(`<div class="island svelte-1o4g66h" role="region" aria-label="Selection actions"><span class="count mono svelte-1o4g66h"> </span> <button type="button" class="act svelte-1o4g66h">Move ▾</button> <button type="button" class="act svelte-1o4g66h">Copy</button> <button type="button" class="act svelte-1o4g66h">Settings</button> <button type="button" class="act svelte-1o4g66h"> </button> <button type="button" class="act danger svelte-1o4g66h">Remove</button> <button type="button" class="clear svelte-1o4g66h">Clear</button></div>`);

	const $$css$g = {
		hash: 'svelte-1o4g66h',
		code: '.island.svelte-1o4g66h {position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:5;display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:10px;background:var(--bg-pop);border:1px solid var(--line-strong);box-shadow:0 8px 26px rgba(0, 0, 0, 0.45);white-space:nowrap;}.count.svelte-1o4g66h {padding-right:4px;font-size:11.5px;font-weight:600;color:var(--text-2);}.act.svelte-1o4g66h {height:26px;padding:0 10px;border-radius:6px;background:var(--bg-raised);border:1px solid var(--line-soft);color:var(--text);font-family:inherit;font-size:11.5px;font-weight:600;white-space:nowrap;cursor:pointer;}.act.svelte-1o4g66h:hover {border-color:var(--line-strong);}.danger.svelte-1o4g66h:hover {background:var(--chip-rose-bg);border-color:var(--chip-rose-line);color:var(--rose-fg);}.clear.svelte-1o4g66h {height:26px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text-4);font-family:inherit;font-size:11.5px;cursor:pointer;}.clear.svelte-1o4g66h:hover {color:var(--text);}'
	};

	function SelectionBar($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$g);

		const count = user_derived(() => quizStore.selection.size);

		/**
		 * Lock is one button. If any selected entry is unlocked it locks all of
		 * them; otherwise it unlocks all of them.
		 */
		const anyUnlocked = user_derived(() => {
			for (const id of quizStore.selection) {
				const block = quizStore.blockOf(id);
				const entry = block?.entries.find((item) => item.id === id);

				if (entry && !entry.locked) return true;
			}

			return false;
		});

		let moveButton = state(null);
		var fragment = comment();
		var node = first_child(fragment);

		{
			var consequent = ($$anchor) => {
				var div = root$g();
				var span = child(div);
				var text = only_child(span);
				var button = sibling(span, 2);

				bind_this(button, ($$value) => set(moveButton, $$value), () => get(moveButton));

				var button_1 = sibling(button, 2);
				var button_2 = sibling(button_1, 2);
				var button_3 = sibling(button_2, 2);
				var text_1 = only_child(button_3, true);
				var button_4 = sibling(button_3, 2);
				var button_5 = sibling(button_4, 2);

				template_effect(() => {
					set_text(text, `${get(count) ?? ''} selected`);
					set_text(text_1, get(anyUnlocked) ? 'Lock' : 'Unlock');
				});

				delegated('click', button, () => get(moveButton) && $$props.onMove(get(moveButton)));
				delegated('click', button_1, () => quizStore.duplicateEntries([...quizStore.selection]));

				delegated('click', button_2, function (...$$args) {
					$$props.onSettings?.apply(this, $$args);
				});

				delegated('click', button_3, () => quizStore.setLocked([...quizStore.selection], get(anyUnlocked)));
				delegated('click', button_4, () => quizStore.removeEntries([...quizStore.selection]));
				delegated('click', button_5, () => quizStore.clearSelection());
				append($$anchor, div);
			};

			if_block(node, ($$render) => {
				if (get(count) > 0) $$render(consequent);
			});
		}

		append($$anchor, fragment);
		pop();
	}

	delegate(['click']);

	var root$f = from_html(`<button type="button">Shuffle blocks</button>`);
	var root_1$e = from_html(`<header class="bar svelte-1ubr2ui"><button type="button" class="back svelte-1ubr2ui" aria-label="Back"><!></button> <h1 class="title svelte-1ubr2ui"> </h1> <label class="name svelte-1ubr2ui"><span class="sr-only"> </span> <input id="amq-ui-quiz-name" type="text" maxlength="50" class="svelte-1ubr2ui"/></label> <div class="totals svelte-1ubr2ui"><span> </span> <span class="sub svelte-1ubr2ui"> </span></div> <!> <button type="button" class="quiet icon svelte-1ubr2ui" aria-label="Undo the last change"><!> Undo</button> <button type="button" class="quiet svelte-1ubr2ui">Reset</button> <button type="button" class="save svelte-1ubr2ui"> </button></header>`);

	const $$css$f = {
		hash: 'svelte-1ubr2ui',
		code: '.bar.svelte-1ubr2ui {flex:none;display:flex;align-items:center;gap:12px;height:60px;padding:0 var(--gutter);background:var(--bg-top);border-bottom:1px solid var(--line);}.back.svelte-1ubr2ui {display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--line-soft);border-radius:7px;background:var(--bg-raised);color:var(--text-2);cursor:pointer;}.back.svelte-1ubr2ui:hover {color:var(--text);border-color:var(--line-strong);}.title.svelte-1ubr2ui {margin:0;font-family:var(--font-display);font-size:17px;font-weight:700;white-space:nowrap;}.name.svelte-1ubr2ui input:where(.svelte-1ubr2ui) {width:220px;height:30px;padding:0 10px;border-radius:7px;background:var(--bg-sunken);border:1px solid var(--line-soft);color:var(--text);font-family:inherit;font-size:13px;outline:none;}.name.svelte-1ubr2ui input:where(.svelte-1ubr2ui):focus {border-color:var(--accent);}.totals.svelte-1ubr2ui {display:flex;flex-direction:column;justify-content:center;margin-left:auto;line-height:1.25;text-align:right;}.headline.svelte-1ubr2ui {font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;}\n\n  /* Over the limit. AMQ refuses the save. */.headline.over.svelte-1ubr2ui {color:var(--rose-fg);}.sub.svelte-1ubr2ui {font-size:10.5px;color:var(--text-4);white-space:nowrap;}.toggle.svelte-1ubr2ui {height:28px;padding:0 10px;border-radius:7px;background:transparent;border:1px dashed var(--chip-off-line);color:var(--chip-off-fg);font-size:11.5px;font-weight:600;white-space:nowrap;cursor:pointer;}.toggle.on.svelte-1ubr2ui {background:var(--chip-violet-bg);border:1px solid var(--chip-violet-line);color:var(--violet-fg);}.quiet.svelte-1ubr2ui {height:30px;padding:0 12px;border-radius:7px;background:var(--bg-raised);border:1px solid var(--line-soft);color:var(--text-2);font-size:12.5px;font-weight:600;cursor:pointer;}.quiet.svelte-1ubr2ui:disabled {opacity:0.4;cursor:default;}.quiet.icon.svelte-1ubr2ui {display:inline-flex;align-items:center;gap:5px;}.save.svelte-1ubr2ui {height:30px;padding:0 16px;border:0;border-radius:7px;background:var(--accent);color:var(--accent-fg);font-size:12.5px;font-weight:700;cursor:pointer;}.save.svelte-1ubr2ui:disabled {opacity:0.6;cursor:default;}'
	};

	function TopBar$1($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$f);

		const totals = user_derived(() => quizStore.totals);
		const overCap = user_derived(() => get(totals).chosen > MAX_SONG_COUNT);
		var header = root_1$e();
		var button = child(header);
		var node = child(button);

		Icon(node, { name: 'back', size: 16 });

		var h1 = sibling(button, 2);
		var text = only_child(h1, true);
		var label = sibling(h1, 2);
		var span = child(label);
		var text_1 = only_child(span, true);
		var input = sibling(span, 2);

		var div = sibling(label, 2);
		var span_1 = child(div);
		let classes;
		var text_2 = only_child(span_1);
		var span_2 = sibling(span_1, 2);
		var text_3 = only_child(span_2);

		var node_1 = sibling(div, 2);

		{
			let $0 = user_derived(() => t('quiz_builder.rule_block_random_order_button.description', 'When toggled on, all rule blocks plays in a random order during quizzes, instead of the set order'));

			Tooltip(node_1, {
				get text() {
					return get($0);
				},

				children: ($$anchor, $$slotProps) => {
					var button_1 = root$f();
					let classes_1;

					template_effect(() => {
						classes_1 = set_class(button_1, 1, 'toggle svelte-1ubr2ui', null, classes_1, { on: quizStore.quiz.ruleBlockRandomOrder });
						set_attribute(button_1, 'aria-pressed', quizStore.quiz.ruleBlockRandomOrder);
					});

					delegated('click', button_1, () => quizStore.quiz.ruleBlockRandomOrder = !quizStore.quiz.ruleBlockRandomOrder);
					append($$anchor, button_1);
				},
				$$slots: { default: true }
			});
		}

		var button_2 = sibling(node_1, 2);
		var node_2 = child(button_2);

		Icon(node_2, { name: 'undo', size: 14 });

		var button_3 = sibling(button_2, 2);
		var button_4 = sibling(button_3, 2);
		var text_4 = only_child(button_4, true);

		template_effect(
			($0, $1, $2, $3) => {
				set_text(text, $0);
				set_text(text_1, $1);
				set_attribute(input, 'placeholder', $2);
				classes = set_class(span_1, 1, 'headline svelte-1ubr2ui', null, classes, { over: get(overCap) });
				set_text(text_2, `${get(totals).uniqueSongs ?? ''} unique songs · ${get(totals).chosen ?? ''} chosen`);

				set_text(text_3, `${get(totals).blocks ?? ''}
      ${get(totals).blocks === 1 ? 'block' : 'blocks'} · ${get(totals).uniqueAnime ?? ''} anime`);

				button_2.disabled = quizStore.undoDepth === 0;

				set_attribute(button_2, 'title', quizStore.undoDepth === 0
					? 'Nothing to undo'
					: `Undo the last change (${quizStore.undoDepth} step${quizStore.undoDepth === 1 ? '' : 's'})`);

				button_3.disabled = !quizStore.dirty;

				set_attribute(button_3, 'title', quizStore.dirty
					? 'Discard all changes since the last save'
					: 'No unsaved changes');

				button_4.disabled = quizStore.saveState === 'saving';
				set_text(text_4, $3);
			},
			[
				() => t('quiz_builder.title', 'Quiz Builder'),
				() => t('quiz_builder.quiz_name', 'Quiz Name'),
				() => t('quiz_builder.quiz_name', 'Quiz Name'),
				() => quizStore.saveState === 'saving'
					? t('quiz_builder.save_window.saving', 'Saving')
					: t('quiz_builder.save', 'Save')
			]
		);

		delegated('click', button, function (...$$args) {
			$$props.onBack?.apply(this, $$args);
		});

		bind_value(input, () => quizStore.quiz.name, ($$value) => quizStore.quiz.name = $$value);
		delegated('click', button_2, () => quizStore.undo());

		delegated('click', button_3, function (...$$args) {
			$$props.onRevert?.apply(this, $$args);
		});

		delegated('click', button_4, function (...$$args) {
			$$props.onSave?.apply(this, $$args);
		});

		append($$anchor, header);
		pop();
	}

	delegate(['click']);

	var root$e = from_html(`<p class="failure svelte-ry34my"> <span class="hint svelte-ry34my">Run <code class="svelte-ry34my">__amqUI.quizBuilder.useLegacy()</code> to open it in AMQ's own
        builder.</span></p>`);

	var root_1$d = from_html(`<div class="panes svelte-ry34my"><!> <div class="quiz-host svelte-ry34my"><!> <!></div></div>`);
	var root_2$9 = from_html(`<div class="screen svelte-ry34my" role="presentation"><!> <!></div> <!> <!> <!> <!> <!> <!> <!>`, 1);

	const $$css$e = {
		hash: 'svelte-ry34my',
		code: '\n  /* Fixed. `bottom: 45px` is the height of AMQ\'s menu bar. */.screen.svelte-ry34my {position:fixed;inset:0 0 45px 0;display:flex;flex-direction:column;font-size:15px;}.panes.svelte-ry34my {flex:1 1 0;min-height:0;display:flex;gap:16px;padding:12px var(--gutter) 12px;}\n\n  /* Positions the selection bar over this pane, not the viewport. */.quiz-host.svelte-ry34my {position:relative;flex:1 1 62%;min-width:0;display:flex;}.failure.svelte-ry34my {margin:48px auto;max-width:460px;text-align:center;color:var(--text-3);}.hint.svelte-ry34my {display:block;margin-top:10px;font-size:12px;color:var(--text-5);}code.svelte-ry34my {font-family:var(--font-mono);font-size:11.5px;color:var(--text-3);}'
	};

	function QuizBuilder($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$e);

		/** The open overlays. The handlers below open one at a time. */
		let picker = state(
			/** Set for a one-off add. Absent means "change the pane's target". */
			null
		);

		let moving = state(null);
		let filters = state(null);
		let blockSettings = state(null);
		let entrySettings = state(null);
		let rowMenu = state(null);
		let saving = state(false);

		function back() {
			viewChanger.changeView('main');
		}

		/**
		 * Checks the name before the save dialog opens, as AMQ does. A dialog with
		 * only a disabled button would not say what is wrong.
		 */
		function save() {
			if (!quizStore.quiz.name.trim()) {
				messageDisplayer?.displayMessage?.(t('quiz_builder.alerts.no_quiz_name.title', 'No Quiz Name'), t('quiz_builder.alerts.no_quiz_name.description', 'You must provide a name for your quiz before saving'));

				return;
			}

			set(saving, true);
		}

		/**
		 * Discards every change since the last save.
		 *
		 * Asks for confirmation through AMQ's Swal, like the game's other
		 * destructive prompts. The text says what happens: the changes are lost.
		 */
		function revert() {
			if (!quizStore.dirty) return;

			Swal.fire({
				title: 'Discard changes?',
				text: quizStore.quizId
					? 'This restores the last saved version of the quiz. You cannot undo it.'
					: 'This removes everything from the quiz. You cannot undo it.',
				showCancelButton: true,
				confirmButtonText: 'Discard',
				cancelButtonText: t('common.ui.cancel_button', 'Cancel')
			}).then((result) => {
				if (result?.isConfirmed) quizStore.revert();
			});
		}

		function addAnime(annId, blockId) {
			quizStore.addEntry(
				{
					kind: 'anime',
					connectUp: false,
					locked: false,
					annId,
					// AMQ's default for a new anime block: openings and endings on,
					// inserts off.
					includeSongTypes: { op: true, ed: true, in: false },
					numberOfSongs: 1,
					overrides: {}
				},
				blockId
			);
		}

		function addSong(annSongId, blockId) {
			quizStore.addEntry(
				{
					kind: 'song',
					connectUp: false,
					locked: false,
					annSongId,
					overrides: {}
				},
				blockId
			);
		}

		/**
		 * Opens AMQ's algorithm dialog. `setModeQuizBuilder` takes the settings to
		 * edit and an object on which it calls `updateSettings` when the player
		 * confirms. We pass a shim that writes to our model. With no entry id the
		 * dialog creates a block, which AMQ routes through
		 * `customQuizCreator.createAlgorithmBlock`. We own that too.
		 */
		function openAlgorithm(entryId) {
			const block = quizStore.quiz.blocks.find((item) => item.entries.some((entry) => entry.id === entryId));
			const entry = block?.entries.find((item) => item.id === entryId);

			if (entry?.kind === 'algorithm') {
				hostModal.setModeQuizBuilder(snapshot(entry.settings), {
					updateSettings: (settings) => {
						quizStore.updateAlgorithmSettings(entryId, settings);
					}
				});
			} else {
				hostModal.setModeQuizBuilder();
			}

			hostModal.show();
		}

		/*
		 * A second click on the button that opened a menu closes it. `Floating`
		 * ignores its own anchor on an outside click, so without this toggle the
		 * second click would close and reopen the menu.
		 */
		function openMenu(anchor, kind, id) {
			set(rowMenu, get(rowMenu)?.anchor === anchor && get(rowMenu).id === id ? null : { anchor, kind, id }, true);
		}

		/**
		 * Whether the focused element takes typed text.
		 *
		 * `tagName === 'INPUT'` is not enough. A click on a row's checkbox focuses
		 * it, and the shortcuts below would then stop working until focus moved.
		 * Only text controls keep their keys.
		 */
		const TYPING_TYPES = new Set([
			'text',
			'search',
			'number',
			'password',
			'email',
			'url',
			'tel'
		]);

		function isTyping(target) {
			if (!target) return false;
			if (target.isContentEditable) return true;
			if (target.tagName === 'TEXTAREA') return true;
			if (target.tagName !== 'INPUT') return false;

			return TYPING_TYPES.has(target.type);
		}

		/** The shortcuts of SPEC §11. Ignored while a text field has focus. */
		function onKeydown(event) {
			const target = event.target;

			if (isTyping(target)) {
				if (event.key === 'Escape') target.blur();

				return;
			}

			const selection = [...quizStore.selection];

			if (event.key === 'Escape') {
				if (get(picker) || get(moving) || get(filters) || get(blockSettings) || get(entrySettings) || get(rowMenu) || get(saving)) {
					set(picker, set(moving, set(filters, null), true), true);
					set(blockSettings, set(entrySettings, null), true);
					set(rowMenu, null);
					set(saving, false);

					return;
				}

				quizStore.clearSelection();

				return;
			}

			if (selection.length === 0) return;

			if (event.key === 'Delete' || event.key === 'Backspace') {
				event.preventDefault();
				quizStore.removeEntries(selection);

				return;
			}

			if (event.key === 'l' || event.key === 'L') {
				quizStore.setLocked(selection, true);

				return;
			}

			if (event.key === 'k' || event.key === 'K') {
				for (const id of selection) quizStore.toggleChain(id);

				return;
			}

			if ((event.key === 'm' || event.key === 'M') && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();

				// No button is under the cursor, so anchor on the focused element.
				const anchor = document.activeElement;

				if (anchor) set(moving, anchor, true);
			}
		}

		/**
		 * Keeps our key events inside the shadow root.
		 *
		 * `setup.js:56` blocks Backspace unless `event.target` is an input. An
		 * event that crosses a shadow boundary is retargeted to the host, so AMQ
		 * sees our wrapper div and cancels the key. Backspace then does nothing in
		 * either search box.
		 */
		function keepKeysLocal(event) {
			if (isTyping(event.target)) {
				event.stopPropagation();
			}
		}

		var fragment = root_2$9();

		event('keydown', $window, onKeydown);

		var div = first_child(fragment);
		var node = child(div);

		TopBar$1(node, { onBack: back, onSave: save, onRevert: revert });

		var node_1 = sibling(node, 2);

		{
			var consequent = ($$anchor) => {
				var p = root$e();
				var text = child(p);

				template_effect(($0) => set_text(text, `${$0 ?? ''} `), [
					() => t('quiz_builder.alerts.error_loading.description', 'An error occurred while trying to load the quiz.')
				]);

				append($$anchor, p);
			};

			var alternate = ($$anchor) => {
				var div_1 = root_1$d();
				var node_2 = child(div_1);

				Library(node_2, {
					onOpenFilters: (anchor) => set(filters, get(filters) ? null : anchor, true),
					onPickTarget: (anchor, then) => set(picker, get(picker)?.anchor === anchor ? null : { anchor, then }, true),
					onAddAnime: addAnime,
					onAddSong: addSong
				});

				var div_2 = sibling(node_2, 2);
				var node_3 = child(div_2);

				QuizList(node_3, {
					onBlockSettings: (id) => set(blockSettings, id, true),
					onEntrySettings: (id) => set(entrySettings, [id], true),
					onAlgorithmSettings: openAlgorithm,
					onMenu: openMenu
				});

				var node_4 = sibling(node_3, 2);

				SelectionBar(node_4, {
					onMove: (anchor) => set(moving, get(moving) === anchor ? null : anchor, true),
					onSettings: () => set(entrySettings, [...quizStore.selection], true)
				});
				append($$anchor, div_1);
			};

			if_block(node_1, ($$render) => {
				if (quizStore.loadFailed) $$render(consequent); else $$render(alternate, -1);
			});
		}

		var node_5 = sibling(div, 2);

		{
			var consequent_1 = ($$anchor) => {
				{
					let $0 = user_derived(() => quizStore.targetBlock?.id ?? null);

					BlockPicker($$anchor, {
						get anchor() {
							return get(picker).anchor;
						},

						get currentId() {
							return get($0);
						},

						onPick: (blockId) => {
							// A pick from any "add to" popover also sets the pane's target
							// (SPEC §4).
							quizStore.targetBlockId = blockId;

							get(picker)?.then?.();
							set(picker, null);
						},
						onDismiss: () => set(picker, null)
					});
				}
			};

			if_block(node_5, ($$render) => {
				if (get(picker)) $$render(consequent_1);
			});
		}

		var node_6 = sibling(node_5, 2);

		{
			var consequent_2 = ($$anchor) => {
				BlockPicker($$anchor, {
					get anchor() {
						return get(moving);
					},

					onPick: (blockId) => {
						quizStore.moveEntries([...quizStore.selection], blockId);
						set(moving, null);
					},
					onDismiss: () => set(moving, null)
				});
			};

			if_block(node_6, ($$render) => {
				if (get(moving)) $$render(consequent_2);
			});
		}

		var node_7 = sibling(node_6, 2);

		{
			var consequent_3 = ($$anchor) => {
				FilterPanel$1($$anchor, {
					get anchor() {
						return get(filters);
					},
					onDismiss: () => set(filters, null)
				});
			};

			if_block(node_7, ($$render) => {
				if (get(filters)) $$render(consequent_3);
			});
		}

		var node_8 = sibling(node_7, 2);

		{
			var consequent_4 = ($$anchor) => {
				BlockSettings($$anchor, {
					get blockId() {
						return get(blockSettings);
					},
					onClose: () => set(blockSettings, null)
				});
			};

			if_block(node_8, ($$render) => {
				if (get(blockSettings)) $$render(consequent_4);
			});
		}

		var node_9 = sibling(node_8, 2);

		{
			var consequent_5 = ($$anchor) => {
				EntrySettings($$anchor, {
					get ids() {
						return get(entrySettings);
					},
					onClose: () => set(entrySettings, null)
				});
			};

			if_block(node_9, ($$render) => {
				if (get(entrySettings) && get(entrySettings).length > 0) $$render(consequent_5);
			});
		}

		var node_10 = sibling(node_9, 2);

		{
			var consequent_6 = ($$anchor) => {
				SaveDialog($$anchor, { onClose: () => set(saving, false) });
			};

			if_block(node_10, ($$render) => {
				if (get(saving)) $$render(consequent_6);
			});
		}

		var node_11 = sibling(node_10, 2);

		{
			var consequent_7 = ($$anchor) => {
				RowMenu($$anchor, {
					get anchor() {
						return get(rowMenu).anchor;
					},

					get kind() {
						return get(rowMenu).kind;
					},

					get id() {
						return get(rowMenu).id;
					},

					onMove: (anchor) => {
						set(rowMenu, null);
						set(moving, anchor, true);
					},

					onSettings: () => {
						const menu = get(rowMenu);

						set(rowMenu, null);

						if (!menu) return;
						if (menu.kind === 'block') set(blockSettings, menu.id, true); else set(entrySettings, [menu.id], true);
					},
					onDismiss: () => set(rowMenu, null)
				});
			};

			if_block(node_11, ($$render) => {
				if (get(rowMenu)) $$render(consequent_7);
			});
		}

		delegated('keydown', div, keepKeysLocal);
		delegated('keyup', div, keepKeysLocal);
		append($$anchor, fragment);
		pop();
	}

	delegate(['keydown', 'keyup']);

	/* filters.svelte.ts generated by Svelte v5.57.0 */

	const STORAGE_KEY = "amq-room-filters";

	const STORAGE_VERSION = 1;

	function group(key, label, options, on) {
		const defaults = {};

		for (const option2 of options) {
			defaults[option2.key] = typeof on === "boolean" ? on : on.includes(option2.key);
		}

		return { key, label, options, defaults };
	}

	function option(key, i18n, fallback) {
		return { key, label: () => t(i18n, fallback) };
	}

	const TOGGLE_GROUPS = [
		group(
			"only",
			() => t("room_browser.filters.only.title", "Show only"),
			[
				option("public", "room_browser.filters.only.public", "Public"),
				option("inLobby", "room_browser.filters.only.in_lobby", "In lobby"),
				option("open", "room_browser.filters.only.open", "Open slots"),
				option("friends", "room_browser.filters.only.friends", "Friends")
			],
			["public"]
		),

		group(
			"scoring",
			() => t("room_browser.filters.scoring.title", "Scoring"),
			[
				option("count", "room_browser.filters.scoring.count", "Count"),
				option("hint", "room_browser.filters.scoring.hint", "Hint"),
				option("speed", "room_browser.filters.scoring.speed", "Speed"),
				option("lives", "room_browser.filters.scoring.lives", "Lives"),
				option("boss", "room_browser.filters.scoring.boss", "Boss")
			],
			true
		),

		group(
			"showSelection",
			() => t("room_browser.filters.show_selection.title", "Show selection"),
			[
				option("auto", "room_browser.filters.show_selection.auto", "Auto"),
				option("looting", "room_browser.filters.show_selection.looting", "Looting")
			],
			true
		),

		group(
			"answering",
			() => t("room_browser.filters.answering_mode.title", "Answering mode"),
			[
				option("typing", "room_browser.filters.answering_mode.typing", "Typing"),
				option("multipleChoice", "room_browser.filters.answering_mode.multiple_choice", "Multiple choice")
			],
			true
		),

		group(
			"animeType",
			() => t("room_browser.filters.anime_type.title", "Anime type"),
			[
				option("tv", "room_browser.filters.anime_type.tv", "TV"),
				option("movie", "room_browser.filters.anime_type.movie", "Movie"),
				option("ova", "room_browser.filters.anime_type.ova", "OVA"),
				option("ona", "room_browser.filters.anime_type.ona", "ONA"),
				option("special", "room_browser.filters.anime_type.special", "Special")
			],
			true
		),

		group(
			"songTypes",
			() => t("room_browser.filters.song_type.title", "Song types"),
			[
				option("openings", "room_browser.filters.song_type.openings", "Openings"),
				option("endings", "room_browser.filters.song_type.endings", "Endings"),
				option("inserts", "room_browser.filters.song_type.inserts", "Inserts")
			],
			true
		),

		group(
			"songSelection",
			() => t("room_browser.filters.song_selection.title", "Song selection"),
			[
				option("watched", "room_browser.filters.song_selection.watched", "Watched"),
				option("unwatched", "room_browser.filters.song_selection.unwatched", "Unwatched"),
				option("random", "room_browser.filters.song_selection.random", "Random")
			],
			true
		),

		group(
			"nonDefault",
			() => t("room_browser.filters.only_non_default.title", "Only non-default"),
			[
				option("samplePoint", "room_browser.filters.only_non_default.sample_point", "Sample point"),
				option("playbackSpeed", "room_browser.filters.only_non_default.playback_speed", "Playback speed"),
				option("animeScore", "room_browser.filters.only_non_default.anime_score", "Anime score"),
				option("vintage", "room_browser.filters.only_non_default.vintage", "Vintage"),
				option("genre", "room_browser.filters.only_non_default.genre", "Genre"),
				option("tags", "room_browser.filters.only_non_default.tag", "Tag"),
				option("songPopularity", "room_browser.filters.only_non_default.popularity", "Popularity")
			],
			false
		)
	];

	const RANGES = [
		{
			key: "roomSize",
			label: () => t("room_browser.filters.number_of_players", "Number of players"),
			min: 2,
			max: 40,
			maxIsUnbounded: true
		},

		{
			key: "songCount",
			label: () => t("room_browser.filters.number_of_songs", "Number of songs"),
			min: 5,
			max: 100
		},

		{
			key: "guessTime",
			label: () => t("room_browser.filters.guess_time", "Guess time"),
			min: 1,
			max: 60
		},

		{
			key: "difficulty",
			label: () => t("room_browser.filters.difficulty", "Difficulty"),
			min: 0,
			max: 100,
			tiers: true
		}
	];

	new Map(TOGGLE_GROUPS.map((entry) => [entry.key, entry]));
	const RANGES_BY_KEY = new Map(RANGES.map((entry) => [entry.key, entry]));

	function defaultState() {
		const toggles = {};

		for (const entry of TOGGLE_GROUPS) {
			toggles[entry.key] = { ...entry.defaults };
		}

		const ranges = {};

		for (const entry of RANGES) {
			ranges[entry.key] = [entry.min, entry.max];
		}

		return {
			search: "",
			toggles,
			ranges,
			sort: { key: "players", dir: "desc" }
		};
	}

	function load() {
		const state = defaultState();
		let stored;

		try {
			const raw = localStorage.getItem(STORAGE_KEY);

			if (!raw) return state;

			stored = JSON.parse(raw);
		} catch {
			return state;
		}

		if (!stored || stored.version !== STORAGE_VERSION) return state;
		if (typeof stored.search === "string") state.search = stored.search;

		for (const entry of TOGGLE_GROUPS) {
			const group2 = stored.toggles?.[entry.key];

			if (!group2) continue;

			for (const option2 of entry.options) {
				if (typeof group2[option2.key] === "boolean") {
					state.toggles[entry.key][option2.key] = group2[option2.key];
				}
			}
		}

		for (const entry of RANGES) {
			const pair = stored.ranges?.[entry.key];

			if (Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite)) {
				state.ranges[entry.key] = [
					clamp(pair[0], entry.min, entry.max),
					clamp(pair[1], entry.min, entry.max)
				];
			}
		}

		if (stored.sort?.key && (stored.sort.dir === "asc" || stored.sort.dir === "desc")) {
			state.sort = { key: stored.sort.key, dir: stored.sort.dir };
		}

		return state;
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	const SAVE_DELAY_MS = 300;

	class FilterStore {
		#state = state(proxy(load()));

		get state() {
			return get(this.#state);
		}

		set state(value) {
			set(this.#state, value, true);
		}

		#saveTimer = null;
		#defaults = defaultState();

		get search() {
			return this.state.search;
		}

		toggles(group2) {
			return this.state.toggles[group2];
		}

		range(key) {
			return this.state.ranges[key];
		}

		groupChanged(key) {
			const current = this.state.toggles[key];
			const base = this.#defaults.toggles[key];

			return Object.keys(base).some((option2) => current[option2] !== base[option2]);
		}

		rangeChanged(key) {
			const [low, high] = this.state.ranges[key];
			const [baseLow, baseHigh] = this.#defaults.ranges[key];

			return low !== baseLow || high !== baseHigh;
		}

		#changedCount = user_derived((/**
		 * How many groups and ranges differ from their default. The Filters badge
		 * and the active strip both read this set (SPEC §4). Search is excluded
		 * because its input is always visible.
		 */
		) => TOGGLE_GROUPS.filter((entry) => this.groupChanged(entry.key)).length + RANGES.filter((entry) => this.rangeChanged(entry.key)).length);

		get changedCount() {
			return get(this.#changedCount);
		}

		set changedCount(value) {
			set(this.#changedCount, value);
		}

		#activeChips = user_derived(() => {
			const chips = [];

			for (const entry of TOGGLE_GROUPS) {
				if (!this.groupChanged(entry.key)) continue;

				const on = entry.options.filter((item) => this.state.toggles[entry.key][item.key]);

				chips.push({
					id: `group-${entry.key}`,
					label: `${entry.label()}: ${on.length
					? on.map((item) => item.label()).join(", ")
					: t("lobby.game_settings.none", "none")}`,
					clear: () => this.resetGroup(entry.key)
				});
			}

			for (const entry of RANGES) {
				if (!this.rangeChanged(entry.key)) continue;

				const [low, high] = this.state.ranges[entry.key];

				chips.push({
					id: `range-${entry.key}`,
					label: `${entry.label()} ${low}–${high}`,
					clear: () => this.resetRange(entry.key)
				});
			}

			return chips;
		});

		get activeChips() {
			return get(this.#activeChips);
		}

		set activeChips(value) {
			set(this.#activeChips, value);
		}

		setSearch(value) {
			this.state.search = value;
			this.#save();
		}

		toggle(group2, option2) {
			const current = this.state.toggles[group2];

			current[option2] = !current[option2];
			this.#save();
		}

		/**
		 * A bound that crosses the other one pushes it along. Values clamp to the
		 * range's limits (SPEC §4).
		 */
		setBound(key, index, raw) {
			const spec = RANGES_BY_KEY.get(key);

			if (!Number.isFinite(raw)) return;

			const value = clamp(Math.round(raw), spec.min, spec.max);
			const pair = [...this.state.ranges[key]];

			pair[index] = value;

			if (index === 0 && value > pair[1]) pair[1] = value;
			if (index === 1 && value < pair[0]) pair[0] = value;

			this.state.ranges[key] = pair;
			this.#save();
		}

		setSort(key) {
			const sort = this.state.sort;

			if (sort.key === key) {
				sort.dir = sort.dir === "desc" ? "asc" : "desc";
			} else {
				this.state.sort = { key, dir: "desc" };
			}

			this.#save();
		}

		resetGroup(key) {
			this.state.toggles[key] = { ...this.#defaults.toggles[key] };
			this.#save();
		}

		resetRange(key) {
			this.state.ranges[key] = [...this.#defaults.ranges[key]];
			this.#save();
		}

		/** Leaves search and sort unchanged. */
		resetAll() {
			const base = defaultState();

			this.state.toggles = base.toggles;
			this.state.ranges = base.ranges;
			this.#save();
		}

		#save() {
			if (this.#saveTimer) clearTimeout(this.#saveTimer);

			this.#saveTimer = setTimeout(
				() => {
					this.#saveTimer = null;

					const snapshot$1 = snapshot(this.state);

					try {
						localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...snapshot$1 }));
					} catch {}
				},
				SAVE_DELAY_MS
			);
		}

		// --- predicate ----------------------------------------------------------
		/** Follows the order of `testRoom` in `roomFilter.js`: cheap tests first. */
		matches(room) {
			const { toggles, ranges } = this.state;
			const settings = room.settings;

			if (!this.#matchesSearch(room)) return false;

			const only = toggles.only;

			if (only.public && room.isPrivate) return false;
			if (only.inLobby && !room.inLobby) return false;
			if (only.open && room.playerCount >= room.roomSize) return false;
			if (only.friends && room.friendNames.length === 0) return false;

			const [sizeLow, sizeHigh] = ranges.roomSize;

			if (sizeLow > room.roomSize) return false;
			if (sizeHigh !== 40 && sizeHigh < room.roomSize) return false;

			const [songLow, songHigh] = ranges.songCount;

			if (room.songCount < songLow || room.songCount > songHigh) return false;

			const [timeLow, timeHigh] = ranges.guessTime;
			const guess = settings.guessTime;

			if (guess) {
				if (guess.randomOn) {
					if (timeLow > guess.randomValue[0] || timeHigh < guess.randomValue[1]) {
						return false;
					}
				} else if (timeLow > guess.standardValue || timeHigh < guess.standardValue) {
					return false;
				}
			}

			const [diffLow, diffHigh] = ranges.difficulty;
			const difficulty = difficultyRange(settings);

			if (diffLow > difficulty.min || diffHigh < difficulty.max) return false;

			const showSelection = toggles.showSelection;

			if (!showSelection.auto && settings.showSelection === 1) return false;
			if (!showSelection.looting && settings.showSelection === 2) return false;

			const scoring = toggles.scoring;

			if (!scoring.count && settings.scoreType === 1) return false;
			if (!scoring.hint && settings.scoreType === 2) return false;
			if (!scoring.speed && settings.scoreType === 3) return false;
			if (!scoring.lives && settings.scoreType === 4) return false;
			if (!scoring.boss && settings.scoreType === 5) return false;

			const songType = settings.songType;

			const inclusion = songType.advancedOn && songType.advancedValue.random === 0
				? {
					openings: songType.advancedValue.openings > 0,
					endings: songType.advancedValue.endings > 0,
					inserts: songType.advancedValue.inserts > 0
				}
				: songType.standardValue;

			const types = toggles.songTypes;

			if (!types.openings && inclusion.openings) return false;
			if (!types.endings && inclusion.endings) return false;
			if (!types.inserts && inclusion.inserts) return false;

			const selection = settings.songSelection?.advancedValue;
			const songSelection = toggles.songSelection;

			if (selection) {
				if (!songSelection.watched && selection.watched > 0) return false;
				if (!songSelection.unwatched && selection.unwatched > 0) return false;
				if (!songSelection.random && selection.random > 0) return false;
			}

			const answering = toggles.answering;

			if (!answering.typing && settings.answeringMode === 1) return false;
			if (!answering.multipleChoice && settings.answeringMode === 3) return false;

			const animeType = settings.type;
			const typeFilter = toggles.animeType;

			if (animeType) {
				if (!typeFilter.tv && animeType.tv) return false;
				if (!typeFilter.movie && animeType.movie) return false;
				if (!typeFilter.ova && animeType.ova) return false;
				if (!typeFilter.ona && animeType.ona) return false;
				if (!typeFilter.special && animeType.special) return false;
			}

			for (const [key, on] of Object.entries(toggles.nonDefault)) {
				if (!on) continue;
				if (isDefault(key, settings[key])) return false;
			}

			return true;
		}

		#matchesSearch(room) {
			const query = this.state.search.trim();

			if (!query) return true;

			const needle = query.toLowerCase();

			if (room.name.toLowerCase().includes(needle)) return true;
			if (room.host.toLowerCase().includes(needle)) return true;
			if (String(room.id).includes(needle)) return true;

			return [...room.players, ...room.spectators].some((player) => player.name.toLowerCase().includes(needle));
		}
	}

	function isDefault(key, value) {
		let base;

		try {
			base = hostModal?.DEFUALT_SETTINGS?.[key];
		} catch {
			base = void 0;
		}

		return isDefaultSetting(value, base);
	}

	const filterStore = new FilterStore();

	function by(pick) {
	  return (a, b) => {
	    const left = pick(a);
	    const right = pick(b);
	    if (typeof left === "string" && typeof right === "string") {
	      return left.localeCompare(right);
	    }
	    return left - right;
	  };
	}
	function typeWeight(room) {
	  const { openings, endings, inserts } = room.songTypes;
	  return (openings ? 4 : 0) + (endings ? 2 : 0) + (inserts ? 1 : 0);
	}
	const COMPARATORS = {
	  // Room ids ascend with creation order: oldest first.
	  id: by((room) => room.id),
	  room: by((room) => room.name.toLowerCase()),
	  mode: by((room) => modeLabel(room.mode)),
	  players: by((room) => room.playerCount),
	  songs: by((room) => room.songCount),
	  // A random range sorts by its minimum, the value the cell shows first.
	  time: by((room) => room.guessTime.range?.min ?? -1),
	  types: by(typeWeight),
	  selection: by((room) => songSelectionLabel$1(room.songSelection)),
	  // A lower % correct is harder, so ascending puts the hardest first.
	  difficulty: by((room) => difficultyRange(room.settings).min)
	};
	function sortRooms(rooms, key, dir) {
	  const compare = COMPARATORS[key];
	  if (!compare) return rooms;
	  const sign = dir === "desc" ? -1 : 1;
	  return [...rooms].sort((a, b) => {
	    const result = compare(a, b);
	    return result !== 0 ? result * sign : a.id - b.id;
	  });
	}

	var root$d = from_html(`<button type="button" class="chip svelte-sj0iy6"> <!></button>`);
	var root_1$c = from_html(`<span class="label svelte-sj0iy6">Active</span> <!> <button type="button" class="clear svelte-sj0iy6">Clear all</button>`, 1);
	var root_2$8 = from_html(`<span class="none svelte-sj0iy6">No filters applied</span>`);
	var root_3$5 = from_html(`<div class="strip svelte-sj0iy6"><!> <div class="spacer svelte-sj0iy6"></div> <span class="count mono svelte-sj0iy6"> </span></div>`);

	const $$css$d = {
		hash: 'svelte-sj0iy6',
		code: '.strip.svelte-sj0iy6 {display:flex;align-items:center;gap:8px;height:46px;padding:0 var(--gutter);background:var(--bg-strip);border-bottom:1px solid rgba(255, 255, 255, 0.07);overflow-x:auto;}.label.svelte-sj0iy6 {font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-4);flex-shrink:0;}.chip.svelte-sj0iy6 {display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 7px 0 10px;border-radius:6px;background:rgba(91, 155, 245, 0.16);border:1px solid rgba(91, 155, 245, 0.36);color:var(--accent-soft);font-size:14px;font-weight:600;white-space:nowrap;cursor:pointer;flex-shrink:0;}.chip.svelte-sj0iy6:hover {background:rgba(91, 155, 245, 0.26);}.clear.svelte-sj0iy6 {height:26px;padding:0 10px;background:transparent;border:0;color:var(--text-4);font-size:14px;font-weight:600;text-decoration:underline;cursor:pointer;flex-shrink:0;}.none.svelte-sj0iy6 {font-size:14px;color:var(--text-5);}.spacer.svelte-sj0iy6 {flex-grow:1;}.count.svelte-sj0iy6 {font-size:14px;color:var(--text-4);white-space:nowrap;}'
	};

	function ActiveFilters($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$d);

		var div = root_3$5();
		var node = child(div);

		{
			var consequent = ($$anchor) => {
				var fragment = root_1$c();
				var node_1 = sibling(first_child(fragment), 2);

				each(node_1, 17, () => $$props.chips, (chip) => chip.id, ($$anchor, chip) => {
					var button = root$d();
					var text = child(button);
					var node_2 = sibling(text);

					Icon(node_2, { name: 'close', size: 11, strokeWidth: 2.6 });
					template_effect(() => set_text(text, `${get(chip).label ?? ''} `));

					delegated('click', button, function (...$$args) {
						get(chip).clear?.apply(this, $$args);
					});

					append($$anchor, button);
				});

				var button_1 = sibling(node_1, 2);

				delegated('click', button_1, function (...$$args) {
					$$props.onClearAll?.apply(this, $$args);
				});

				append($$anchor, fragment);
			};

			var alternate = ($$anchor) => {
				var span = root_2$8();

				append($$anchor, span);
			};

			if_block(node, ($$render) => {
				if ($$props.chips.length) $$render(consequent); else $$render(alternate, -1);
			});
		}

		var span_1 = sibling(node, 4);
		var text_1 = only_child(span_1);
		template_effect(() => set_text(text_1, `${$$props.shown ?? ''} of ${$$props.total ?? ''} rooms shown`));
		append($$anchor, div);
		pop();
	}

	delegate(['click']);

	var root$c = from_html(`<span><!></span>`);
	var root_1$b = from_html(`<button type="button"> <!></button>`);
	var root_2$7 = from_html(`<div class="header svelte-d2bw8i"><!> <span class="col static grow svelte-d2bw8i">Modifiers · genres · tags</span> <span class="col static svelte-d2bw8i" aria-hidden="true"></span></div>`);

	const $$css$c = {
		hash: 'svelte-d2bw8i',
		code: '.header.svelte-d2bw8i {display:flex;align-items:center;gap:var(--col-gap);height:44px;padding:0 var(--row-pad);border-radius:var(--radius) var(--radius) 0 0;background:var(--bg-head);border:1px solid var(--line-soft);border-bottom:1px solid var(--line-strong);}.col.svelte-d2bw8i {display:flex;align-items:center;gap:4px;\n    /* Fixed columns must not shrink. The rows do not shrink either, and the\n       headings must stay aligned with them. */flex:0 0 auto;min-width:0;padding:0;background:transparent;border:0;color:var(--text-4);font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-align:left;cursor:pointer;}\n\n  /*\n   * The chips column takes the leftover width. The basis is 0, not `auto`:\n   * with `auto` the header label and a row\'s chips would each size the column\n   * from their own content and get different widths. `min-width` replaces the\n   * flex default of `auto`, which would raise the column to its min-content\n   * size.\n   */.col.grow.svelte-d2bw8i {flex:1 1 0;min-width:var(--col-chips);}.col.right.svelte-d2bw8i {justify-content:flex-end;}.col.static.svelte-d2bw8i {cursor:default;}.col.svelte-d2bw8i:not(.static):hover {color:var(--text-2);}.col.active.svelte-d2bw8i {color:var(--accent-soft);}.arrow.svelte-d2bw8i {display:inline-flex;}.arrow.up.svelte-d2bw8i {transform:rotate(180deg);}'
	};

	function ColumnHeader($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$c);

		const COLUMNS = /** The token with this column's width. Absent for the flexible column. */
		[
			{ key: 'id', label: 'ID', width: 'var(--col-id)' },
			{
				key: 'room',
				label: 'Room / Host',
				width: 'var(--col-identity)'
			},
			{ key: 'mode', label: 'Mode', width: 'var(--col-mode)' },
			{
				key: 'selection',
				label: 'Selection',
				width: 'var(--col-selection)'
			},
			{ key: 'types', label: 'Types', width: 'var(--col-types)' },
			{
				key: 'players',
				label: 'Players',
				width: 'var(--col-players)'
			},
			{ key: 'songs', label: 'Songs', width: 'var(--col-songs)' },
			{
				key: 'time',
				label: 'Time',
				width: 'var(--col-time)',
				align: 'right'
			},

			{
				key: 'difficulty',
				label: 'Difficulty',
				width: 'var(--col-difficulty)'
			}
		];

		function sortLabel(key, label) {
			if ($$props.sort.key !== key) return `${label}, sort by this column`;

			return $$props.sort.dir === 'asc'
				? `${label}, sorted ascending`
				: `${label}, sorted descending`;
		}

		var div = root_2$7();
		var node = child(div);

		each(node, 17, () => COLUMNS, (column) => column.key, ($$anchor, column) => {
			var button = root_1$b();
			let classes;
			let styles;
			var text = child(button);
			var node_1 = sibling(text);

			{
				var consequent = ($$anchor) => {
					var span = root$c();
					let classes_1;
					var node_2 = child(span);

					Icon(node_2, { name: 'caret', size: 11, strokeWidth: 3 });
					template_effect(() => classes_1 = set_class(span, 1, 'arrow svelte-d2bw8i', null, classes_1, { up: $$props.sort.dir === 'asc' }));
					append($$anchor, span);
				};

				if_block(node_1, ($$render) => {
					if ($$props.sort.key === get(column).key) $$render(consequent);
				});
			}

			template_effect(
				($0) => {
					classes = set_class(button, 1, 'col svelte-d2bw8i', null, classes, {
						flex: !get(column).width,
						right: get(column).align === 'right',
						active: $$props.sort.key === get(column).key
					});

					set_attribute(button, 'aria-label', $0);
					styles = set_style(button, '', styles, { width: get(column).width });
					set_text(text, `${get(column).label ?? ''} `);
				},
				[() => sortLabel(get(column).key, get(column).label)]
			);

			delegated('click', button, () => $$props.onSort(get(column).key));
			append($$anchor, button);
		});

		var span_1 = sibling(node, 4);

		set_style(span_1, '', {}, { width: 'var(--col-action)' });
		append($$anchor, div);
		pop();
	}

	delegate(['click']);

	var root$b = from_html(`<button type="button" class="reset svelte-1yc2l3d"><span class="dot svelte-1yc2l3d"></span> Reset</button>`);
	var root_1$a = from_html(`<div class="band svelte-1yc2l3d"></div>`);
	var root_2$6 = from_html(`<div class="bands svelte-1yc2l3d"></div>`);
	var root_3$4 = from_html(`<div class="legend-row svelte-1yc2l3d"><span class="swatch svelte-1yc2l3d"></span> <span class="legend-name svelte-1yc2l3d"> </span> <div class="rule svelte-1yc2l3d"></div> <span class="legend-range mono svelte-1yc2l3d"> </span></div>`);
	var root_4$1 = from_html(`<div class="legend svelte-1yc2l3d" role="tooltip"><div class="legend-head svelte-1yc2l3d">Share of players who guess correctly</div> <!></div>`);
	var root_5$1 = from_html(`<div class="group svelte-1yc2l3d"><div class="head svelte-1yc2l3d"><span class="title svelte-1yc2l3d"> </span> <div class="rule svelte-1yc2l3d"></div> <!></div> <div class="controls svelte-1yc2l3d"><label class="sr-only"> </label> <input class="num mono svelte-1yc2l3d" type="number"/> <div><div class="track svelte-1yc2l3d"></div> <!> <div></div> <input type="range"/> <input type="range"/> <!></div> <label class="sr-only"> </label> <input class="num mono svelte-1yc2l3d" type="number"/></div></div>`);

	const $$css$b = {
		hash: 'svelte-1yc2l3d',
		code: '.group.svelte-1yc2l3d {margin-bottom:14px;}.head.svelte-1yc2l3d {display:flex;align-items:center;gap:8px;height:16px;margin-bottom:8px;}.title.svelte-1yc2l3d {font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#a3acbb;white-space:nowrap;}.rule.svelte-1yc2l3d {flex-grow:1;height:1px;background:rgba(255, 255, 255, 0.08);}.reset.svelte-1yc2l3d {display:inline-flex;align-items:center;gap:5px;height:16px;padding:0;background:transparent;border:0;color:var(--blue-fg);font-size:10px;font-weight:600;cursor:pointer;}.dot.svelte-1yc2l3d {width:5px;height:5px;border-radius:50%;background:var(--accent);}.controls.svelte-1yc2l3d {display:flex;align-items:center;gap:10px;}.num.svelte-1yc2l3d {width:54px;height:26px;padding:0 4px;text-align:center;border-radius:6px;background:var(--bg-sunken);border:1px solid rgba(255, 255, 255, 0.14);color:var(--text);font-size:12px;-moz-appearance:textfield;appearance:textfield;}.num.svelte-1yc2l3d:focus {outline:none;border-color:var(--accent);}.num.svelte-1yc2l3d::-webkit-outer-spin-button,\n  .num.svelte-1yc2l3d::-webkit-inner-spin-button {-webkit-appearance:none;margin:0;}.track-host.svelte-1yc2l3d {position:relative;flex-grow:1;height:18px;}.track.svelte-1yc2l3d,\n  .bands.svelte-1yc2l3d,\n  .fill.svelte-1yc2l3d {position:absolute;top:7px;height:4px;border-radius:2px;}.track.svelte-1yc2l3d {left:0;right:0;background:rgba(255, 255, 255, 0.12);}.bands.svelte-1yc2l3d {left:0;right:0;display:flex;overflow:hidden;opacity:0.42;}.band.svelte-1yc2l3d {height:4px;}.fill.svelte-1yc2l3d {background:rgba(255, 255, 255, 0.34);}.fill.on.svelte-1yc2l3d {background:var(--accent);}.rng.svelte-1yc2l3d {position:absolute;left:0;top:0;width:100%;height:18px;margin:0;padding:0;background:transparent;-webkit-appearance:none;appearance:none;\n    /* Only the thumbs accept the pointer. See the header comment. */pointer-events:none;}.rng.svelte-1yc2l3d:focus {outline:none;}.rng.svelte-1yc2l3d::-webkit-slider-runnable-track {height:18px;background:transparent;border:none;}.rng.svelte-1yc2l3d::-moz-range-track {height:18px;background:transparent;border:none;}.rng.svelte-1yc2l3d::-webkit-slider-thumb {-webkit-appearance:none;appearance:none;width:16px;height:16px;margin-top:1px;border-radius:50%;background:#fff;border:3px solid var(--text-5);box-sizing:border-box;cursor:grab;pointer-events:auto;}.rng.svelte-1yc2l3d::-moz-range-thumb {width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid var(--text-5);box-sizing:border-box;cursor:grab;pointer-events:auto;}.rng.on.svelte-1yc2l3d::-webkit-slider-thumb {border-color:var(--accent);}.rng.on.svelte-1yc2l3d::-moz-range-thumb {border-color:var(--accent);}.rng.svelte-1yc2l3d:focus-visible::-webkit-slider-thumb {box-shadow:0 0 0 3px rgba(91, 155, 245, 0.45);}.legend.svelte-1yc2l3d {position:absolute;z-index:40;right:-6px;bottom:calc(100% + 6px);width:208px;padding:7px 9px;border-radius:var(--radius);background:var(--bg-pop);border:1px solid var(--line-strong);box-shadow:0 8px 22px rgba(0, 0, 0, 0.55);opacity:0;visibility:hidden;transition:opacity 0.12s ease;pointer-events:none;}.has-tiers.svelte-1yc2l3d:hover .legend:where(.svelte-1yc2l3d),\n  .has-tiers.svelte-1yc2l3d:focus-within .legend:where(.svelte-1yc2l3d) {opacity:1;visibility:visible;}.legend-head.svelte-1yc2l3d {margin-bottom:5px;font-size:10px;color:var(--text-4);}.legend-row.svelte-1yc2l3d {display:flex;align-items:center;gap:8px;padding:1px 0;}.swatch.svelte-1yc2l3d {width:9px;height:9px;border-radius:2px;flex-shrink:0;}.legend-name.svelte-1yc2l3d {font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;}.legend-range.svelte-1yc2l3d {font-size:10px;color:var(--text-3);white-space:nowrap;}'
	};

	function RangeSlider($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$b);

		/**
		 * The same shape as the room browser's `RangeSpec`. Declared here so the
		 * quiz builder can use the slider without importing the room filter module.
		 */
		/** Draws the five difficulty tier bands behind the track. */
		/** The maximum means "unlimited", not the literal `max`. */
		const id = user_derived(() => `rng-${$$props.spec.key}`);

		const title = user_derived(() => $$props.spec.label());
		const span = user_derived(() => $$props.spec.max - $$props.spec.min);
		const lowPct = user_derived(() => ($$props.value[0] - $$props.spec.min) / get(span) * 100);
		const highPct = user_derived(() => ($$props.value[1] - $$props.spec.min) / get(span) * 100);
		var div = root_5$1();
		var div_1 = child(div);
		var span_1 = child(div_1);
		var text = only_child(span_1, true);
		var node = sibling(span_1, 4);

		{
			var consequent = ($$anchor) => {
				var button = root$b();

				delegated('click', button, function (...$$args) {
					$$props.onReset?.apply(this, $$args);
				});

				append($$anchor, button);
			};

			if_block(node, ($$render) => {
				if ($$props.changed) $$render(consequent);
			});
		}

		var div_2 = sibling(div_1, 2);
		var label = child(div_2);
		var text_1 = only_child(label);
		var input = sibling(label, 2);

		var div_3 = sibling(input, 2);
		let classes;
		var node_1 = sibling(child(div_3), 2);

		{
			var consequent_1 = ($$anchor) => {
				var div_4 = root_2$6();

				each(div_4, 21, () => DIFFICULTY_TIERS, (tier) => tier.key, ($$anchor, tier) => {
					var div_5 = root_1$a();
					let styles;

					template_effect(() => styles = set_style(div_5, '', styles, {
						width: `${get(tier).max - get(tier).min}%`,
						background: get(tier).colour
					}));

					append($$anchor, div_5);
				});
				append($$anchor, div_4);
			};

			if_block(node_1, ($$render) => {
				if ($$props.spec.tiers) $$render(consequent_1);
			});
		}

		var div_6 = sibling(node_1, 2);
		let classes_1;
		let styles_1;
		var input_1 = sibling(div_6, 2);

		let classes_2;
		var input_2 = sibling(input_1, 2);

		let classes_3;
		var node_2 = sibling(input_2, 2);

		{
			var consequent_2 = ($$anchor) => {
				var div_7 = root_4$1();
				var node_3 = sibling(child(div_7), 2);

				each(node_3, 17, () => DIFFICULTY_TIERS, (tier) => tier.key, ($$anchor, tier) => {
					var div_8 = root_3$4();
					var span_2 = child(div_8);
					let styles_2;
					var span_3 = sibling(span_2, 2);
					var text_2 = only_child(span_3, true);
					var span_4 = sibling(span_3, 4);
					var text_3 = only_child(span_4);

					template_effect(
						($0) => {
							styles_2 = set_style(span_2, '', styles_2, { background: get(tier).colour });
							set_text(text_2, $0);
							set_text(text_3, `${get(tier).min ?? ''}–${get(tier).max ?? ''}%`);
						},
						[() => tierLabel(get(tier))]
					);

					append($$anchor, div_8);
				});
				append($$anchor, div_7);
			};

			if_block(node_2, ($$render) => {
				if ($$props.spec.tiers) $$render(consequent_2);
			});
		}

		var label_1 = sibling(div_3, 2);
		var text_4 = only_child(label_1);
		var input_3 = sibling(label_1, 2);

		template_effect(() => {
			set_text(text, get(title));
			set_attribute(label, 'for', `${get(id) ?? ''}-lo`);
			set_text(text_1, `${get(title) ?? ''} minimum`);
			set_attribute(input, 'id', `${get(id) ?? ''}-lo`);
			set_attribute(input, 'min', $$props.spec.min);
			set_attribute(input, 'max', $$props.spec.max);
			set_value(input, $$props.value[0]);
			classes = set_class(div_3, 1, 'track-host svelte-1yc2l3d', null, classes, { 'has-tiers': $$props.spec.tiers });
			classes_1 = set_class(div_6, 1, 'fill svelte-1yc2l3d', null, classes_1, { on: $$props.changed });

			styles_1 = set_style(div_6, '', styles_1, {
				left: `${get(lowPct) ?? ''}%`,
				width: `${get(highPct) - get(lowPct)}%`
			});

			classes_2 = set_class(input_1, 1, 'rng svelte-1yc2l3d', null, classes_2, { on: $$props.changed });
			set_attribute(input_1, 'min', $$props.spec.min);
			set_attribute(input_1, 'max', $$props.spec.max);
			set_value(input_1, $$props.value[0]);
			set_attribute(input_1, 'aria-label', `${get(title) ?? ''} lower bound`);
			classes_3 = set_class(input_2, 1, 'rng svelte-1yc2l3d', null, classes_3, { on: $$props.changed });
			set_attribute(input_2, 'min', $$props.spec.min);
			set_attribute(input_2, 'max', $$props.spec.max);
			set_value(input_2, $$props.value[1]);
			set_attribute(input_2, 'aria-label', `${get(title) ?? ''} upper bound`);
			set_attribute(label_1, 'for', `${get(id) ?? ''}-hi`);
			set_text(text_4, `${get(title) ?? ''} maximum`);
			set_attribute(input_3, 'id', `${get(id) ?? ''}-hi`);
			set_attribute(input_3, 'min', $$props.spec.min);
			set_attribute(input_3, 'max', $$props.spec.max);
			set_value(input_3, $$props.value[1]);
		});

		delegated('change', input, (event) => $$props.onInput(0, event.currentTarget.valueAsNumber));
		delegated('input', input_1, (event) => $$props.onInput(0, event.currentTarget.valueAsNumber));
		delegated('input', input_2, (event) => $$props.onInput(1, event.currentTarget.valueAsNumber));
		delegated('change', input_3, (event) => $$props.onInput(1, event.currentTarget.valueAsNumber));
		append($$anchor, div);
		pop();
	}

	delegate(['click', 'change', 'input']);

	var root$a = from_html(`<button type="button" class="reset svelte-cy0hyx"><span class="dot svelte-cy0hyx"></span> Reset</button>`);
	var root_1$9 = from_html(`<div class="group svelte-cy0hyx"><div class="group-head svelte-cy0hyx"><span class="group-title svelte-cy0hyx"> </span> <div class="rule svelte-cy0hyx"></div> <!></div> <div class="chips svelte-cy0hyx"></div></div>`);
	var root_2$5 = from_html(`<span class="badge mono svelte-cy0hyx"> </span>`);
	var root_3$3 = from_html(`<div class="panel svelte-cy0hyx"><div class="head svelte-cy0hyx"><span class="head-icon svelte-cy0hyx"><!></span> <span class="head-title svelte-cy0hyx">Filters</span> <!> <div class="spacer svelte-cy0hyx"></div> <button type="button">Reset all</button> <button type="button" class="close svelte-cy0hyx" aria-label="Close filters"><!></button></div> <div class="body svelte-cy0hyx"><div class="column"></div> <div class="column"><!> <!> <!></div></div></div>`);

	const $$css$a = {
		hash: 'svelte-cy0hyx',
		code: '.panel.svelte-cy0hyx {width:680px;border-radius:var(--radius);background:rgba(12, 16, 23, 0.98);border:1px solid var(--line-strong);box-shadow:0 18px 44px rgba(0, 0, 0, 0.6);}.head.svelte-cy0hyx {display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;border-bottom:1px solid rgba(255, 255, 255, 0.09);}.head-icon.svelte-cy0hyx {display:inline-flex;color:var(--accent-soft);}.head-title.svelte-cy0hyx {font-size:14px;font-weight:600;color:#ffffff;}.badge.svelte-cy0hyx {font-size:11px;font-weight:600;color:#08101c;background:var(--accent);border-radius:5px;padding:1px 6px;}.spacer.svelte-cy0hyx {flex-grow:1;}.reset-all.svelte-cy0hyx {height:26px;padding:0 10px;border-radius:6px;background:transparent;border:1px solid rgba(255, 255, 255, 0.14);color:#5b6472;font-size:12px;font-weight:600;cursor:default;}.reset-all.enabled.svelte-cy0hyx {color:var(--text-2);cursor:pointer;}.close.svelte-cy0hyx {width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:transparent;border:0;color:var(--text-4);cursor:pointer;}.close.svelte-cy0hyx:hover {color:var(--text);}.body.svelte-cy0hyx {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:22px;padding:16px;}.group.svelte-cy0hyx {margin-bottom:15px;}.group.svelte-cy0hyx:last-child {margin-bottom:0;}.group-head.svelte-cy0hyx {display:flex;align-items:center;gap:8px;height:16px;margin-bottom:8px;}.group-title.svelte-cy0hyx {font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#a3acbb;white-space:nowrap;}.rule.svelte-cy0hyx {flex-grow:1;height:1px;background:rgba(255, 255, 255, 0.08);}.reset.svelte-cy0hyx {display:inline-flex;align-items:center;gap:5px;height:16px;padding:0;background:transparent;border:0;color:var(--blue-fg);font-size:10px;font-weight:600;cursor:pointer;}.dot.svelte-cy0hyx {width:5px;height:5px;border-radius:50%;background:var(--accent);}.chips.svelte-cy0hyx {display:flex;flex-wrap:wrap;gap:5px;}'
	};

	function FilterPanel($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$a);

		const toggleGroup = ($$anchor, key = noop) => {
			const group = user_derived(() => byKey.get(key()));
			const isChanged = user_derived(() => $$props.filters.groupChanged(key()));
			var div = root_1$9();
			var div_1 = child(div);
			var span = child(div_1);
			var text = only_child(span, true);
			var node = sibling(span, 4);

			{
				var consequent = ($$anchor) => {
					var button = root$a();

					delegated('click', button, () => $$props.filters.resetGroup(key()));
					append($$anchor, button);
				};

				if_block(node, ($$render) => {
					if (get(isChanged)) $$render(consequent);
				});
			}

			var div_2 = sibling(div_1, 2);

			each(div_2, 21, () => get(group).options, (option) => option.key, ($$anchor, option) => {
				{
					let $0 = user_derived(() => get(option).label());
					let $1 = user_derived(() => $$props.filters.toggles(key())[get(option).key]);

					ToggleChip($$anchor, {
						get label() {
							return get($0);
						},

						get on() {
							return get($1);
						},
						onToggle: () => $$props.filters.toggle(key(), get(option).key)
					});
				}
			});
			template_effect(($0) => set_text(text, $0), [() => get(group).label()]);
			append($$anchor, div);
		};

		const LEFT = ['only', 'scoring', 'showSelection', 'answering', 'animeType'];
		const RIGHT_TOP = ['songTypes', 'songSelection'];
		const RIGHT_BOTTOM = ['nonDefault'];
		const byKey = new Map(TOGGLE_GROUPS.map((entry) => [entry.key, entry]));
		const groups = (keys) => keys.map((key) => byKey.get(key));
		const changed = user_derived(() => $$props.filters.changedCount > 0);
		var div_3 = root_3$3();
		var div_4 = child(div_3);
		var span_1 = child(div_4);
		var node_1 = child(span_1);

		Icon(node_1, { name: 'filter', size: 16 });

		var node_2 = sibling(span_1, 4);

		{
			var consequent_1 = ($$anchor) => {
				var span_2 = root_2$5();
				var text_1 = only_child(span_2, true);

				template_effect(() => set_text(text_1, $$props.filters.changedCount));
				append($$anchor, span_2);
			};

			if_block(node_2, ($$render) => {
				if (get(changed)) $$render(consequent_1);
			});
		}

		var button_1 = sibling(node_2, 4);
		let classes;
		var button_2 = sibling(button_1, 2);
		var node_3 = child(button_2);

		Icon(node_3, { name: 'close', size: 14, strokeWidth: 2.6 });

		var div_5 = sibling(div_4, 2);
		var div_6 = child(div_5);

		each(div_6, 21, () => groups(LEFT), (group) => group.key, ($$anchor, group) => {
			toggleGroup($$anchor, () => get(group).key);
		});

		var div_7 = sibling(div_6, 2);
		var node_4 = child(div_7);

		each(node_4, 17, () => groups(RIGHT_TOP), (group) => group.key, ($$anchor, group) => {
			toggleGroup($$anchor, () => get(group).key);
		});

		var node_5 = sibling(node_4, 2);

		each(node_5, 17, () => RANGES, (spec) => spec.key, ($$anchor, spec) => {
			{
				let $0 = user_derived(() => $$props.filters.range(get(spec).key));
				let $1 = user_derived(() => $$props.filters.rangeChanged(get(spec).key));

				RangeSlider($$anchor, {
					get spec() {
						return get(spec);
					},

					get value() {
						return get($0);
					},

					get changed() {
						return get($1);
					},
					onInput: (index, value) => $$props.filters.setBound(get(spec).key, index, value),
					onReset: () => $$props.filters.resetRange(get(spec).key)
				});
			}
		});

		var node_6 = sibling(node_5, 2);

		each(node_6, 17, () => groups(RIGHT_BOTTOM), (group) => group.key, ($$anchor, group) => {
			toggleGroup($$anchor, () => get(group).key);
		});

		template_effect(() => {
			classes = set_class(button_1, 1, 'reset-all svelte-cy0hyx', null, classes, { enabled: get(changed) });
			button_1.disabled = !get(changed);
		});

		delegated('click', button_1, () => $$props.filters.resetAll());

		delegated('click', button_2, function (...$$args) {
			$$props.onClose?.apply(this, $$args);
		});

		append($$anchor, div_3);
		pop();
	}

	delegate(['click']);

	var root$9 = from_html(`<span> </span>`);

	const $$css$9 = {
		hash: 'svelte-1ypl3kj',
		code: '.chip.svelte-1ypl3kj {display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:4px;font-family:var(--font-mono);font-size:11px;font-weight:500;white-space:nowrap;background:var(--chip-bg);border:1px solid var(--chip-line);color:var(--chip-fg);}\n\n  /* A dashed border marks an optional genre or tag. */.dashed.svelte-1ypl3kj {background:transparent;border-style:dashed;}.tone-teal.svelte-1ypl3kj {--chip-bg: var(--chip-teal-bg);--chip-line: var(--chip-teal-line);--chip-fg: var(--teal-fg);}.tone-amber.svelte-1ypl3kj {--chip-bg: var(--chip-amber-bg);--chip-line: var(--chip-amber-line);--chip-fg: var(--amber-fg);}.tone-violet.svelte-1ypl3kj {--chip-bg: var(--chip-violet-bg);--chip-line: var(--chip-violet-line);--chip-fg: var(--violet-fg);}.tone-rose.svelte-1ypl3kj {--chip-bg: var(--chip-rose-bg);--chip-line: var(--chip-rose-line);--chip-fg: var(--rose-fg);}.tone-blue.svelte-1ypl3kj {--chip-bg: var(--chip-blue-bg);--chip-line: var(--chip-blue-line);--chip-fg: var(--blue-fg);}.tone-off.svelte-1ypl3kj {--chip-bg: var(--chip-off-bg);--chip-line: var(--chip-off-line);--chip-fg: var(--chip-off-fg);}'
	};

	function Chip($$anchor, $$props) {
		append_styles$1($$anchor, $$css$9);

		let dashed = prop($$props, 'dashed', 3, false);

		Tooltip($$anchor, {
			get text() {
				return $$props.tooltip;
			},

			children: ($$anchor, $$slotProps) => {
				var span = root$9();
				let classes;
				var text = only_child(span, true);

				template_effect(() => {
					classes = set_class(span, 1, `chip tone-${$$props.tone ?? ''}`, 'svelte-1ypl3kj', classes, { dashed: dashed() });
					set_text(text, $$props.label);
				});

				append($$anchor, span);
			},
			$$slots: { default: true }
		});
	}

	const widths = new Map();
	let context = null;

	function measure(label) {
		const cached = widths.get(label);

		if (cached !== undefined) return cached;

		if (!context) {
			context = document.createElement('canvas').getContext('2d');

			if (context) {
				context.font = "500 11px 'IBM Plex Mono', ui-monospace, monospace";
			}
		}

		// Without a canvas, estimate the width per character.
		const value = context ? context.measureText(label).width : label.length * 5.5;

		widths.set(label, value);

		return value;
	}

	var root$8 = from_html(`<span class="more svelte-1sajf5u"> </span>`);
	var root_1$8 = from_html(`<div class="cell svelte-1sajf5u"><!> <!></div>`);

	const $$css$8 = {
		hash: 'svelte-1sajf5u',
		code: '\n  /*\n   * Two lines of chips, centred in the 56px row: two 22px chips and the 4px\n   * gap make 48px.\n   */.cell.svelte-1sajf5u {display:flex;flex-wrap:wrap;align-content:center;gap:4px;height:48px;\n    /* Same as `.col.grow` in ColumnHeader. See the comment there. */flex:1 1 0;min-width:var(--col-chips);overflow:hidden;}.more.svelte-1sajf5u {display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:4px;font-family:var(--font-mono);font-size:11px;font-weight:500;white-space:nowrap;background:var(--chip-off-bg);border:1px solid var(--chip-off-line);color:var(--chip-off-fg);}'
	};

	function ChipsCell($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$8);

		const GAP = 4;
		const CHIP_PADDING = 18; // 8px padding and 1px border on each side
		const OVERFLOW_RESERVE = 38; // width kept free for the `+N` chip

		/** Two 22px chips and the 4px gap. See the `.cell` height below. */
		const MAX_LINES = 2;

		let cell = state(null);
		let width = state(0);

		user_effect(() => {
			const element = get(cell);

			if (!element) return;

			const observer = new ResizeObserver(([entry]) => {
				set(width, entry.contentRect.width, true);
			});

			observer.observe(element);
			set(width, element.clientWidth, true);

			return () => observer.disconnect();
		});

		const fitted = user_derived(() => {
			if (!get(width) || !$$props.chips.length) {
				return { shown: $$props.chips, hidden: [] };
			}

			// Pack with the full width first. Reserve space for the `+N` chip only if
			// something overflows; otherwise the reserve would drop a chip that fits.
			const full = pack($$props.chips, get(width), get(width));

			return full.hidden.length
				? pack($$props.chips, get(width), get(width) - OVERFLOW_RESERVE)
				: full;
		});

		/**
		 * Fills up to `MAX_LINES` lines, left to right. `lastLineBudget` is the
		 * width of the last line, which is narrower when it also holds the `+N`
		 * chip.
		 */
		function pack(list, budget, lastLineBudget) {
			const shown = [];
			const hidden = [];
			const budgetFor = (line) => line === MAX_LINES - 1 ? lastLineBudget : budget;
			let line = 0;
			let used = 0;

			for (const chip of list) {
				// After the first hidden chip, hide all the rest. The visible chips and
				// the tooltip then keep the same order.
				if (hidden.length) {
					hidden.push(chip);

					continue;
				}

				const chipWidth = measure(chip.label) + CHIP_PADDING;
				const needed = used ? used + GAP + chipWidth : chipWidth;

				if (needed <= budgetFor(line)) {
					shown.push(chip);
					used = needed;

					continue;
				}

				if (line + 1 < MAX_LINES && chipWidth <= budgetFor(line + 1)) {
					line += 1;
					used = chipWidth;
					shown.push(chip);

					continue;
				}

				hidden.push(chip);
			}

			return { shown, hidden };
		}

		const overflowTooltip = user_derived(() => `Also on this room: ${get(fitted).hidden.map((chip) => chip.label).join(', ')}`);
		var div = root_1$8();
		var node = child(div);

		each(node, 17, () => get(fitted).shown, (chip) => chip.id, ($$anchor, chip) => {
			Chip($$anchor, {
				get label() {
					return get(chip).label;
				},

				get tone() {
					return get(chip).tone;
				},

				get tooltip() {
					return get(chip).tooltip;
				},

				get dashed() {
					return get(chip).dashed;
				}
			});
		});

		var node_1 = sibling(node, 2);

		{
			var consequent = ($$anchor) => {
				Tooltip($$anchor, {
					get text() {
						return get(overflowTooltip);
					},
					wide: true,
					children: ($$anchor, $$slotProps) => {
						var span = root$8();
						var text = only_child(span);

						template_effect(() => set_text(text, `+${get(fitted).hidden.length ?? ''}`));
						append($$anchor, span);
					},
					$$slots: { default: true }
				});
			};

			if_block(node_1, ($$render) => {
				if (get(fitted).hidden.length) $$render(consequent);
			});
		}
		bind_this(div, ($$value) => set(cell, $$value), () => get(cell));
		append($$anchor, div);
		pop();
	}

	var root$7 = from_html(`<div class="band svelte-122txv6"></div>`);
	var root_1$7 = from_html(`<div class="tip-row svelte-122txv6"><span class="swatch svelte-122txv6"></span> <span class="tier-name svelte-122txv6"> </span> <div class="spacer svelte-122txv6"></div> <span class="tier-range mono svelte-122txv6"> </span></div>`);
	var root_2$4 = from_html(`<div class="tip-head svelte-122txv6"> </div> <!>`, 1);
	var root_3$2 = from_html(`<div class="cell svelte-122txv6" role="presentation"><div class="bands svelte-122txv6"><!> <div class="mask svelte-122txv6"></div> <div class="mask svelte-122txv6"></div></div> <div class="label mono svelte-122txv6"> </div></div> <!>`, 1);

	const $$css$7 = {
		hash: 'svelte-122txv6',
		code: '.cell.svelte-122txv6 {flex:0 0 var(--col-difficulty);}.bands.svelte-122txv6 {position:relative;display:flex;height:5px;border-radius:3px;overflow:hidden;}.band.svelte-122txv6 {height:5px;}.mask.svelte-122txv6 {position:absolute;top:0;height:5px;background:rgba(13, 17, 25, 0.78);}.label.svelte-122txv6 {margin-top:4px;font-size:13px;color:var(--text-3);white-space:nowrap;}.tip-head.svelte-122txv6 {margin-bottom:6px;font-size:11px;color:var(--text-4);white-space:nowrap;}.tip-row.svelte-122txv6 {display:flex;align-items:center;gap:8px;padding:2px 0;}.swatch.svelte-122txv6 {width:10px;height:10px;border-radius:2px;flex-shrink:0;}.tier-name.svelte-122txv6 {font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;}.spacer.svelte-122txv6 {flex-grow:1;}.tier-range.svelte-122txv6 {font-size:11px;color:var(--text-3);white-space:nowrap;}'
	};

	function DifficultyCell($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$7);

		const range = user_derived(() => difficultyRange($$props.room.settings));
		const touched = user_derived(() => tiersTouched(get(range)));
		let anchor = state(null);
		let open = state(false);
		var fragment = root_3$2();
		var div = first_child(fragment);
		var div_1 = child(div);
		var node = child(div_1);

		each(node, 17, () => DIFFICULTY_TIERS, (tier) => tier.key, ($$anchor, tier) => {
			var div_2 = root$7();
			let styles;

			template_effect(() => styles = set_style(div_2, '', styles, {
				width: `${get(tier).max - get(tier).min}%`,
				background: get(tier).colour
			}));

			append($$anchor, div_2);
		});

		var div_3 = sibling(node, 2);
		let styles_1;
		var div_4 = sibling(div_3, 2);
		let styles_2;

		var div_5 = sibling(div_1, 2);
		var text = only_child(div_5);
		bind_this(div, ($$value) => set(anchor, $$value), () => get(anchor));

		var node_1 = sibling(div, 2);

		{
			var consequent = ($$anchor) => {
				Floating($$anchor, {
					get anchor() {
						return get(anchor);
					},
					placement: 'below',
					onDismiss: () => set(open, false),
					children: ($$anchor, $$slotProps) => {
						var fragment_2 = root_2$4();
						var div_6 = first_child(fragment_2);
						var text_1 = only_child(div_6);
						var node_2 = sibling(div_6, 2);

						each(node_2, 17, () => get(touched), (tier) => tier.key, ($$anchor, tier) => {
							var div_7 = root_1$7();
							var span = child(div_7);
							let styles_3;
							var span_1 = sibling(span, 2);
							var text_2 = only_child(span_1, true);
							var span_2 = sibling(span_1, 4);
							var text_3 = only_child(span_2);

							template_effect(
								($0) => {
									styles_3 = set_style(span, '', styles_3, { background: get(tier).colour });
									set_text(text_2, $0);
									set_text(text_3, `${get(tier).min ?? ''}–${get(tier).max ?? ''}%`);
								},
								[() => tierLabel(get(tier))]
							);

							append($$anchor, div_7);
						});

						template_effect(() => set_text(text_1, `Difficulty ${get(range).min ?? ''}–${get(range).max ?? ''}%`));
						append($$anchor, fragment_2);
					},
					$$slots: { default: true }
				});
			};

			if_block(node_1, ($$render) => {
				if (get(open) && get(anchor)) $$render(consequent);
			});
		}

		template_effect(() => {
			styles_1 = set_style(div_3, '', styles_1, { left: '0', width: `${get(range).min ?? ''}%` });

			styles_2 = set_style(div_4, '', styles_2, {
				left: `${get(range).max ?? ''}%`,
				width: `${100 - get(range).max}%`
			});

			set_text(text, `${get(range).min ?? ''}–${get(range).max ?? ''}%`);
		});

		event('mouseenter', div, () => set(open, true));
		event('mouseleave', div, () => set(open, false));
		delegated('focusin', div, () => set(open, true));
		delegated('focusout', div, () => set(open, false));
		append($$anchor, fragment);
		pop();
	}

	delegate(['focusin', 'focusout']);

	var root$6 = from_html(`<div class="row svelte-1elzj7b"><button type="button"> </button> <div class="spacer svelte-1elzj7b"></div> <span class="level mono svelte-1elzj7b"> </span></div>`);
	var root_1$6 = from_html(`<div class="empty svelte-1elzj7b">—</div>`);
	var root_2$3 = from_html(`<div class="section-title divided svelte-1elzj7b"> </div> <!>`, 1);
	var root_3$1 = from_html(`<div class="section-title svelte-1elzj7b"> </div> <!> <!>`, 1);

	const $$css$6 = {
		hash: 'svelte-1elzj7b',
		code: '.section-title.svelte-1elzj7b {margin-bottom:5px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-4);}.section-title.divided.svelte-1elzj7b {margin:8px 0 5px;padding-top:7px;border-top:1px solid rgba(255, 255, 255, 0.1);}.row.svelte-1elzj7b {display:flex;align-items:baseline;gap:10px;padding:2px 0;}.spacer.svelte-1elzj7b {flex-grow:1;}.name.svelte-1elzj7b {background:none;border:0;padding:0;text-align:left;cursor:pointer;font-size:13px;font-weight:600;color:var(--text);}.name.svelte-1elzj7b:hover {text-decoration:underline;}.name.spectator.svelte-1elzj7b {font-weight:500;color:var(--text-3);}\n\n  /* The name is coloured as well as the count, so the friend signal appears\n     in both places (SPEC §7). */.name.friend.svelte-1elzj7b {color:var(--teal-fg);}.level.svelte-1elzj7b {font-size:11px;color:var(--text-3);}.empty.svelte-1elzj7b {font-size:12px;color:var(--text-5);}'
	};

	function RosterPopover($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$6);

		const friends = user_derived(() => new Set($$props.friendNames));

		/**
		 * `buildPlayerList` in roomTile.js sorts friends first, then blocked
		 * players.
		 *
		 * Duplicates are dropped. The list is keyed by name, and a keyed `{#each}`
		 * throws on a duplicate key, which breaks the whole screen. The store keeps
		 * the roster unique, but the payload is the server's.
		 */
		function ordered(list) {
			const seen = new Set();

			return list.filter((player) => !seen.has(player.name) && seen.add(player.name)).sort((a, b) => rank(a.name) - rank(b.name));
		}

		function rank(name) {
			if (get(friends).has(name)) return 0;

			try {
				if (socialTab.isBlocked(name)) return 1;
			} catch {
				// `socialTab` is not ready yet. Treat the player as not blocked.
			}

			return 2;
		}

		var fragment = root_3$1();
		var div = first_child(fragment);
		var text = only_child(div, true);
		var node = sibling(div, 2);

		each(
			node,
			17,
			() => ordered($$props.players),
			(player) => player.name,
			($$anchor, player) => {
				var div_1 = root$6();
				var button = child(div_1);
				let classes;
				var text_1 = only_child(button, true);
				var span = sibling(button, 4);
				var text_2 = only_child(span, true);

				template_effect(
					($0) => {
						classes = set_class(button, 1, 'name svelte-1elzj7b', null, classes, { friend: $0 });
						set_text(text_1, get(player).name);
						set_text(text_2, get(player).level);
					},
					[() => get(friends).has(get(player).name)]
				);

				delegated('click', button, (event) => openProfile(event.currentTarget, get(player).name));
				append($$anchor, div_1);
			},
			($$anchor) => {
				var div_2 = root_1$6();

				append($$anchor, div_2);
			}
		);

		var node_1 = sibling(node, 2);

		{
			var consequent = ($$anchor) => {
				var fragment_1 = root_2$3();
				var div_3 = first_child(fragment_1);
				var text_3 = only_child(div_3, true);
				var node_2 = sibling(div_3, 2);

				each(node_2, 17, () => ordered($$props.spectators), (player) => player.name, ($$anchor, player) => {
					var div_4 = root$6();
					var button_1 = child(div_4);
					let classes_1;
					var text_4 = only_child(button_1, true);
					var span_1 = sibling(button_1, 4);
					var text_5 = only_child(span_1, true);

					template_effect(
						($0) => {
							classes_1 = set_class(button_1, 1, 'name spectator svelte-1elzj7b', null, classes_1, { friend: $0 });
							set_text(text_4, get(player).name);
							set_text(text_5, get(player).level);
						},
						[() => get(friends).has(get(player).name)]
					);

					delegated('click', button_1, (event) => openProfile(event.currentTarget, get(player).name));
					append($$anchor, div_4);
				});

				template_effect(($0) => set_text(text_3, $0), [
					() => t('room_browser.room_tile.popovers.spectators', 'Spectators')
				]);

				append($$anchor, fragment_1);
			};

			if_block(node_1, ($$render) => {
				if ($$props.spectators.length) $$render(consequent);
			});
		}

		template_effect(($0) => set_text(text, $0), [
			() => t('room_browser.room_tile.popovers.players', 'Players')
		]);

		append($$anchor, fragment);
		pop();
	}

	delegate(['click']);

	var root$5 = from_html(`<span class="specs mono svelte-fd6uy5"><!> </span>`);
	var root_1$5 = from_html(`<div class="cell players svelte-fd6uy5" role="presentation"><div class="bar svelte-fd6uy5"><div></div></div> <div class="counts svelte-fd6uy5"><span> </span> <!></div></div> <!>`, 1);

	const $$css$5 = {
		hash: 'svelte-fd6uy5',
		code: '.cell.svelte-fd6uy5 {flex:0 0 var(--col-players);}.bar.svelte-fd6uy5 {height:5px;border-radius:3px;background:rgba(255, 255, 255, 0.12);overflow:hidden;}.fill.svelte-fd6uy5 {height:5px;background:var(--accent);}.fill.full.svelte-fd6uy5 {background:var(--rose);}\n\n  /*\n   * Baseline-aligned and pushed to the two ends of the bar: `used/cap` under\n   * its start, the spectator count under its end.\n   *\n   * The two spans have different font sizes, so centring their boxes does not\n   * align the text. Baseline alignment is correct for any font metrics, and\n   * the fallback fonts measure differently from IBM Plex Mono.\n   */.counts.svelte-fd6uy5 {display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-top:4px;}.count.svelte-fd6uy5 {font-size:13px;font-weight:500;white-space:nowrap;color:var(--text-2);}\n\n  /* The friend colour below takes priority over "full". */.count.full.svelte-fd6uy5 {color:var(--rose-fg);}.count.friend.svelte-fd6uy5 {color:var(--teal-fg);}\n\n  /*\n   * `align-items: baseline` exposes this box\'s text baseline to the row. The\n   * eye icon gets `align-self: center`. As the first item with no baseline of\n   * its own, it would otherwise make the browser derive one from its bottom\n   * edge, which places the whole group too high.\n   */.specs.svelte-fd6uy5 {display:inline-flex;align-items:baseline;gap:3px;font-size:12px;color:var(--chip-off-fg);}.specs.svelte-fd6uy5 svg {align-self:center;flex-shrink:0;}'
	};

	function PlayersCell($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$5);

		const full = user_derived(() => $$props.room.playerCount >= $$props.room.roomSize);
		const hasFriends = user_derived(() => $$props.room.friendNames.length > 0);

		const fillPct = user_derived(() => $$props.room.roomSize > 0
			? Math.min(100, Math.round($$props.room.playerCount / $$props.room.roomSize * 100))
			: 0);

		let anchor = state(null);
		let open = state(false);
		let dismiss = null;

		// The delay lets the pointer cross the gap between the cell and the popover.
		const DISMISS_DELAY_MS = 180;

		function show() {
			if (dismiss) {
				clearTimeout(dismiss);
				dismiss = null;
			}

			set(open, true);
		}

		function hide() {
			if (dismiss) clearTimeout(dismiss);

			dismiss = setTimeout(
				() => {
					dismiss = null;
					set(open, false);
				},
				DISMISS_DELAY_MS
			);
		}

		var fragment = root_1$5();
		var div = first_child(fragment);
		var div_1 = child(div);
		var div_2 = child(div_1);
		let classes;
		let styles;

		var div_3 = sibling(div_1, 2);
		var span = child(div_3);
		let classes_1;
		var text = only_child(span);
		var node = sibling(span, 2);

		{
			var consequent = ($$anchor) => {
				var span_1 = root$5();
				var node_1 = child(span_1);

				Icon(node_1, { name: 'eye', size: 12, strokeWidth: 2.4 });

				var text_1 = sibling(node_1);
				template_effect(() => set_text(text_1, ` ${$$props.room.spectatorCount ?? ''}`));
				append($$anchor, span_1);
			};

			if_block(node, ($$render) => {
				if ($$props.room.spectatorCount > 0) $$render(consequent);
			});
		}
		bind_this(div, ($$value) => set(anchor, $$value), () => get(anchor));

		var node_2 = sibling(div, 2);

		{
			var consequent_1 = ($$anchor) => {
				Floating($$anchor, {
					get anchor() {
						return get(anchor);
					},
					placement: 'below',
					width: 210,
					onEnter: show,
					onLeave: hide,
					onDismiss: () => set(open, false),
					children: ($$anchor, $$slotProps) => {
						RosterPopover($$anchor, {
							get players() {
								return $$props.room.players;
							},

							get spectators() {
								return $$props.room.spectators;
							},

							get friendNames() {
								return $$props.room.friendNames;
							}
						});
					},
					$$slots: { default: true }
				});
			};

			if_block(node_2, ($$render) => {
				if (get(open) && get(anchor)) $$render(consequent_1);
			});
		}

		template_effect(() => {
			classes = set_class(div_2, 1, 'fill svelte-fd6uy5', null, classes, { full: get(full) });
			styles = set_style(div_2, '', styles, { width: `${get(fillPct) ?? ''}%` });
			classes_1 = set_class(span, 1, 'count mono svelte-fd6uy5', null, classes_1, { friend: get(hasFriends), full: get(full) });
			set_text(text, `${$$props.room.playerCount ?? ''}/${$$props.room.roomSize ?? ''}`);
		});

		event('mouseenter', div, show);
		event('mouseleave', div, hide);
		delegated('focusin', div, show);
		delegated('focusout', div, hide);
		append($$anchor, fragment);
		pop();
	}

	delegate(['focusin', 'focusout']);

	var root$4 = from_html(`<div class="total mono svelte-177nyfl"> </div> <div class="caption svelte-177nyfl"> </div>`, 1);
	var root_1$4 = from_html(`<div class="bar svelte-177nyfl"><div class="fill svelte-177nyfl"></div></div> <div class="progress mono svelte-177nyfl"><!> </div>`, 1);
	var root_2$2 = from_html(`<div class="cell svelte-177nyfl"><!></div>`);

	const $$css$4 = {
		hash: 'svelte-177nyfl',
		code: '.cell.svelte-177nyfl {flex:0 0 var(--col-songs);}.total.svelte-177nyfl {font-size:14px;color:var(--text-2);}.caption.svelte-177nyfl {margin-top:2px;font-size:12px;color:var(--text-5);}.bar.svelte-177nyfl {height:5px;border-radius:3px;background:rgba(255, 255, 255, 0.1);overflow:hidden;}.fill.svelte-177nyfl {height:5px;background:rgba(255, 255, 255, 0.52);}.progress.svelte-177nyfl {display:flex;align-items:center;gap:4px;margin-top:4px;font-size:12px;color:#a3acbb;white-space:nowrap;}'
	};

	function SongsCell($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$4);

		// `songsLeft` counts down. The cell shows the songs already played.
		const played = user_derived(() => Math.max(0, $$props.room.songCount - $$props.room.songsLeft));

		const pct = user_derived(() => $$props.room.songCount > 0
			? Math.round(get(played) / $$props.room.songCount * 100)
			: 0);

		var div = root_2$2();
		var node = child(div);

		{
			var consequent = ($$anchor) => {
				var fragment = root$4();
				var div_1 = first_child(fragment);
				var text = only_child(div_1, true);
				var div_2 = sibling(div_1, 2);
				var text_1 = only_child(div_2, true);

				template_effect(
					($0) => {
						set_text(text, $$props.room.songCount);
						set_text(text_1, $0);
					},
					[() => t('room_browser.room_tile.in_lobby', 'in lobby')]
				);

				append($$anchor, fragment);
			};

			var alternate = ($$anchor) => {
				var fragment_1 = root_1$4();
				var div_3 = first_child(fragment_1);
				var div_4 = child(div_3);
				let styles;

				var div_5 = sibling(div_3, 2);
				var node_1 = child(div_5);

				Icon(node_1, { name: 'play', size: 9 });

				var text_2 = sibling(node_1);

				template_effect(() => {
					styles = set_style(div_4, '', styles, { width: `${get(pct) ?? ''}%` });
					set_text(text_2, ` ${get(played) ?? ''} / ${$$props.room.songCount ?? ''}`);
				});

				append($$anchor, fragment_1);
			};

			if_block(node, ($$render) => {
				if ($$props.room.inLobby) $$render(consequent); else $$render(alternate, -1);
			});
		}
		append($$anchor, div);
		pop();
	}

	var root$3 = from_html(`<span><span class="glyph svelte-14ydh0w"> </span></span>`);
	var root_1$3 = from_html(`<div class="cell svelte-14ydh0w"></div>`);

	const $$css$3 = {
		hash: 'svelte-14ydh0w',
		code: '.cell.svelte-14ydh0w {display:flex;gap:4px;flex:0 0 var(--col-types);}.type.svelte-14ydh0w {display:inline-flex;align-items:center;justify-content:center;width:32px;height:22px;border-radius:4px;font-family:var(--font-mono);font-size:12px;font-weight:600;background:transparent;border:1px dashed rgba(255, 255, 255, 0.12);color:#545d6b;}\n\n  /*\n   * The labels are all capitals, so nothing goes below the baseline, but the\n   * line box still reserves room for descenders. Centring the box leaves the\n   * letters too high: at 12px IBM Plex Mono there is 5.4px above the glyphs\n   * and 7.9px below. A 1px shift evens that out and stays on the pixel grid.\n   */.glyph.svelte-14ydh0w {position:relative;top:1px;}.type.on.svelte-14ydh0w {background:rgba(91, 155, 245, 0.22);border:1px solid rgba(91, 155, 245, 0.45);color:#9cc4f9;}'
	};

	function TypesCell($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$3);

		const entries = user_derived(() => [
			{
				key: 'openings',
				short: 'OP',
				label: t('room_browser.room_tile.song_types.opening', 'Openings')
			},

			{
				key: 'endings',
				short: 'ED',
				label: t('room_browser.room_tile.song_types.ending', 'Endings')
			},

			{
				key: 'inserts',
				short: 'IN',
				label: t('room_browser.room_tile.song_types.insert', 'Inserts')
			}
		]);

		var div = root_1$3();

		each(div, 21, () => get(entries), (entry) => entry.key, ($$anchor, entry) => {
			{
				let $0 = user_derived(() => get(entry).label);
				let $1 = user_derived(() => $$props.types[get(entry).key] ? 'played' : 'not played');

				Tooltip($$anchor, {
					get text() {
						return `${get($0) ?? ''} — ${get($1) ?? ''}`;
					},

					children: ($$anchor, $$slotProps) => {
						var span = root$3();
						let classes;
						var span_1 = child(span);
						var text = only_child(span_1, true);

						template_effect(() => {
							classes = set_class(span, 1, 'type svelte-14ydh0w', null, classes, { on: $$props.types[get(entry).key] });
							set_text(text, get(entry).short);
						});

						append($$anchor, span);
					},
					$$slots: { default: true }
				});
			}
		});
		append($$anchor, div);
		pop();
	}

	var root$2 = from_html(`<img sizes="30px" alt="" class="svelte-1t1x2e"/>`);
	var root_1$2 = from_html(`<span class="lock svelte-1t1x2e"><!></span>`);
	var root_2$1 = from_html(`<span class="time-extra mono svelte-1t1x2e"> </span>`);
	var root_3 = from_html(`<span class="time-base mono svelte-1t1x2e"> </span> <!>`, 1);
	var root_4 = from_html(`<span class="time-base mono svelte-1t1x2e">—</span>`);
	var root_5 = from_html(`<button type="button" class="settings svelte-1t1x2e"><!></button>`);
	var root_6 = from_html(`<div><div class="id mono svelte-1t1x2e"> </div> <div class="identity svelte-1t1x2e"><div class="avatar svelte-1t1x2e"><!></div> <div class="names svelte-1t1x2e"><div class="name-line svelte-1t1x2e"><span class="name svelte-1t1x2e"> </span> <!></div> <button type="button" class="host svelte-1t1x2e"> </button></div></div> <div class="mode-cell svelte-1t1x2e"><span> </span></div> <div class="selection-cell svelte-1t1x2e"><span> </span></div> <!> <!> <!> <div class="time svelte-1t1x2e"><!></div> <!> <!> <div class="actions svelte-1t1x2e"><!> <button type="button"> </button> <button type="button" class="spec svelte-1t1x2e"> </button></div></div>`);

	const $$css$2 = {
		hash: 'svelte-1t1x2e',
		code: '.row.svelte-1t1x2e {display:flex;align-items:center;gap:var(--col-gap);height:56px;padding:0 var(--row-pad);border-bottom:1px solid var(--line);background:transparent;}.row.zebra.svelte-1t1x2e {background:var(--bg-row);}.row.svelte-1t1x2e:hover {background:var(--bg-row-hover);}\n\n  /* Each fixed column is `flex: 0 0 <token>` so it matches the header. */.id.svelte-1t1x2e {flex:0 0 var(--col-id);font-size:13px;color:var(--text-5);}.identity.svelte-1t1x2e {flex:0 0 var(--col-identity);min-width:0;display:flex;align-items:center;gap:9px;}.avatar.svelte-1t1x2e {width:36px;height:36px;flex-shrink:0;border-radius:50%;background:#343a47;border:1px solid rgba(255, 255, 255, 0.18);overflow:hidden;}.avatar.svelte-1t1x2e img:where(.svelte-1t1x2e) {width:100%;height:100%;object-fit:cover;}.names.svelte-1t1x2e {min-width:0;}.name-line.svelte-1t1x2e {display:flex;align-items:center;gap:6px;}.name.svelte-1t1x2e {font-size:15px;font-weight:600;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.lock.svelte-1t1x2e {display:inline-flex;color:var(--rose);flex-shrink:0;}.host.svelte-1t1x2e {display:block;max-width:100%;padding:0;background:none;border:0;text-align:left;cursor:pointer;font-size:13px;color:var(--text-4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.host.svelte-1t1x2e:hover {color:var(--text-2);text-decoration:underline;}.mode-cell.svelte-1t1x2e {flex:0 0 var(--col-mode);min-width:0;}\n\n  /* The cell fits "Last Man Standing", the longest label AMQ ships. A longer\n     label gets an ellipsis. */.pill.svelte-1t1x2e {display:inline-flex;align-items:center;max-width:100%;height:22px;padding:0 9px;border-radius:5px;font-size:12px;font-weight:700;letter-spacing:0.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--pill-bg);color:var(--pill-fg);}.tone-blue.svelte-1t1x2e {--pill-bg: rgba(91, 155, 245, 0.15);--pill-fg: var(--blue-fg);--sel-bg: var(--chip-blue-bg);--sel-line: rgba(91, 155, 245, 0.3);--sel-fg: var(--blue-fg);}.tone-teal.svelte-1t1x2e {--pill-bg: rgba(52, 201, 163, 0.15);--pill-fg: var(--teal-fg);--sel-bg: rgba(52, 201, 163, 0.15);--sel-line: var(--chip-teal-line);--sel-fg: var(--teal-fg);}.tone-amber.svelte-1t1x2e {--pill-bg: rgba(232, 163, 61, 0.15);--pill-fg: var(--amber-fg);--sel-bg: var(--chip-amber-bg);--sel-line: var(--chip-amber-line);--sel-fg: var(--amber-fg);}.tone-rose.svelte-1t1x2e {--pill-bg: rgba(229, 101, 138, 0.15);--pill-fg: var(--rose-fg);}.tone-cyan.svelte-1t1x2e {--pill-bg: rgba(63, 185, 214, 0.16);--pill-fg: var(--cyan-fg);}.tone-violet.svelte-1t1x2e {--pill-bg: rgba(155, 124, 245, 0.15);--pill-fg: var(--violet-fg);--sel-bg: rgba(155, 124, 245, 0.14);--sel-line: rgba(155, 124, 245, 0.34);--sel-fg: var(--violet-fg);}.time.svelte-1t1x2e {flex:0 0 var(--col-time);display:flex;align-items:baseline;justify-content:flex-end;gap:4px;}.time-base.svelte-1t1x2e {font-size:14px;color:var(--text-2);}\n\n  /* Extra time is secondary, so it is smaller and dimmer. */.time-extra.svelte-1t1x2e {font-size:12px;color:var(--text-4);white-space:nowrap;}.selection-cell.svelte-1t1x2e {flex:0 0 var(--col-selection);}.sel.svelte-1t1x2e {display:inline-flex;align-items:center;height:22px;padding:0 10px;border-radius:4px;font-size:13px;font-weight:600;white-space:nowrap;background:var(--sel-bg);border:1px solid var(--sel-line);color:var(--sel-fg);}.actions.svelte-1t1x2e {flex:0 0 var(--col-action);display:flex;align-items:center;justify-content:flex-end;gap:6px;}.settings.svelte-1t1x2e,\n  .join.svelte-1t1x2e,\n  .spec.svelte-1t1x2e {height:30px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;}\n\n  /*\n   * Fixed widths that fit the longest labels, "Spectate" and "Playing". With\n   * content sizing, the buttons move sideways when a room starts or ends a\n   * game.\n   */.join.svelte-1t1x2e,\n  .spec.svelte-1t1x2e {flex:0 0 78px;padding:0;text-align:center;}.settings.svelte-1t1x2e {display:inline-flex;align-items:center;justify-content:center;flex:0 0 30px;padding:0;background:rgba(255, 255, 255, 0.06);border:1px solid rgba(255, 255, 255, 0.12);color:var(--text-3);}.settings.svelte-1t1x2e:hover {background:rgba(255, 255, 255, 0.13);color:var(--text);}.join.svelte-1t1x2e {background:var(--accent);border:0;color:var(--accent-fg);font-weight:700;}.join.locked.svelte-1t1x2e {background:rgba(255, 255, 255, 0.035);border:1px solid rgba(255, 255, 255, 0.08);color:var(--text-5);cursor:not-allowed;}.spec.svelte-1t1x2e {background:rgba(255, 255, 255, 0.06);border:1px solid rgba(255, 255, 255, 0.12);color:var(--text-2);}.spec.svelte-1t1x2e:hover {background:rgba(255, 255, 255, 0.11);}'
	};

	function RoomRow($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$2);

		const full = user_derived(() => $$props.room.playerCount >= $$props.room.roomSize);
		const locked = user_derived(() => get(full) || !$$props.room.inLobby);
		const avatar = user_derived(() => avatarImage($$props.room.hostAvatar));
		const chips = user_derived(() => chipsFor($$props.room.settings));
		const guess = user_derived(() => $$props.room.guessTime);

		// Some avatars and outfits have no head crop. The fallback is the full
		// render, positioned on the face with `object-position` (SPEC §3).
		let headFailed = state(false);

		const joinLabel = user_derived(() => !$$props.room.inLobby
			? t('room_browser.room_tile.playing', 'Playing')
			: get(full)
				? t('room_browser.room_tile.full', 'Full')
				: t('room_browser.room_tile.join', 'Join'));

		var div = root_6();
		let classes;
		var div_1 = child(div);
		var text = only_child(div_1, true);
		var div_2 = sibling(div_1, 2);
		var div_3 = child(div_2);
		var node = child(div_3);

		{
			var consequent = ($$anchor) => {
				var img = root$2();
				let styles;

				template_effect(() => {
					set_attribute(img, 'src', get(headFailed) ? get(avatar).fallbackSrc : get(avatar).src);
					set_attribute(img, 'srcset', get(headFailed) ? undefined : get(avatar).srcset);

					styles = set_style(img, '', styles, {
						'object-position': get(headFailed) ? get(avatar).fallbackPosition : '50% 50%'
					});
				});

				event('error', img, () => set(headFailed, true));
				append($$anchor, img);
			};

			if_block(node, ($$render) => {
				if (get(avatar)) $$render(consequent);
			});
		}

		var div_4 = sibling(div_3, 2);
		var div_5 = child(div_4);
		var span = child(div_5);
		var text_1 = only_child(span, true);
		var node_1 = sibling(span, 2);

		{
			var consequent_1 = ($$anchor) => {
				var span_1 = root_1$2();
				var node_2 = child(span_1);

				Icon(node_2, { name: 'lock', size: 10, strokeWidth: 2.6 });
				template_effect(($0) => set_attribute(span_1, 'title', $0), [() => t('room_browser.room_tile.private', 'Private room')]);
				append($$anchor, span_1);
			};

			if_block(node_1, ($$render) => {
				if ($$props.room.isPrivate) $$render(consequent_1);
			});
		}

		var button = sibling(div_5, 2);
		var text_2 = only_child(button, true);

		var div_6 = sibling(div_2, 2);
		var span_2 = child(div_6);
		var text_3 = only_child(span_2, true);

		var div_7 = sibling(div_6, 2);
		var span_3 = child(div_7);
		var text_4 = only_child(span_3, true);

		var node_3 = sibling(div_7, 2);

		TypesCell(node_3, {
			get types() {
				return $$props.room.songTypes;
			}
		});

		var node_4 = sibling(node_3, 2);

		PlayersCell(node_4, {
			get room() {
				return $$props.room;
			}
		});

		var node_5 = sibling(node_4, 2);

		SongsCell(node_5, {
			get room() {
				return $$props.room;
			}
		});

		var div_8 = sibling(node_5, 2);
		var node_6 = child(div_8);

		{
			var consequent_3 = ($$anchor) => {
				var fragment = root_3();
				var span_4 = first_child(fragment);
				var text_5 = only_child(span_4);
				var node_7 = sibling(span_4, 2);

				{
					var consequent_2 = ($$anchor) => {
						var span_5 = root_2$1();
						var text_6 = only_child(span_5);

						template_effect(($0) => set_text(text_6, `+ ${$0 ?? ''}s`), [() => rangeLabel(get(guess).extra)]);
						append($$anchor, span_5);
					};

					if_block(node_7, ($$render) => {
						if (get(guess).extra) $$render(consequent_2);
					});
				}

				template_effect(($0) => set_text(text_5, `${$0 ?? ''}s`), [() => rangeLabel(get(guess).range)]);
				append($$anchor, fragment);
			};

			var alternate = ($$anchor) => {
				var span_6 = root_4();

				append($$anchor, span_6);
			};

			if_block(node_6, ($$render) => {
				if (get(guess).range) $$render(consequent_3); else $$render(alternate, -1);
			});
		}

		var node_8 = sibling(div_8, 2);

		DifficultyCell(node_8, {
			get room() {
				return $$props.room;
			}
		});

		var node_9 = sibling(node_8, 2);

		ChipsCell(node_9, {
			get chips() {
				return get(chips);
			}
		});

		var div_9 = sibling(node_9, 2);
		var node_10 = child(div_9);

		{
			let $0 = user_derived(() => t('room_browser.room_tile.popovers.all_settings', 'All settings'));

			Tooltip(node_10, {
				get text() {
					return get($0);
				},

				children: ($$anchor, $$slotProps) => {
					var button_1 = root_5();
					var node_11 = child(button_1);

					Icon(node_11, { name: 'sliders', size: 15 });

					template_effect(($0) => set_attribute(button_1, 'aria-label', $0), [
						() => t('room_browser.room_tile.popovers.all_settings', 'All settings')
					]);

					delegated('click', button_1, () => $$props.onSettings($$props.room));
					append($$anchor, button_1);
				},
				$$slots: { default: true }
			});
		}

		var button_2 = sibling(node_10, 2);
		let classes_1;
		var text_7 = only_child(button_2, true);
		var button_3 = sibling(button_2, 2);
		var text_8 = only_child(button_3, true);

		template_effect(
			($0, $1, $2, $3, $4) => {
				classes = set_class(div, 1, 'row svelte-1t1x2e', null, classes, { zebra: $$props.zebra });
				set_text(text, $$props.room.id);
				set_text(text_1, $$props.room.name);
				set_text(text_2, $$props.room.host);
				set_class(span_2, 1, `pill tone-${$0 ?? ''}`, 'svelte-1t1x2e');
				set_text(text_3, $1);
				set_class(span_3, 1, `sel tone-${$2 ?? ''}`, 'svelte-1t1x2e');
				set_text(text_4, $3);
				classes_1 = set_class(button_2, 1, 'join svelte-1t1x2e', null, classes_1, { locked: get(locked) });
				button_2.disabled = get(locked);
				set_text(text_7, get(joinLabel));
				set_text(text_8, $4);
			},
			[
				() => modeTone($$props.room.mode),
				() => modeLabel($$props.room.mode),
				() => songSelectionTone($$props.room.songSelection),
				() => songSelectionLabel$1($$props.room.songSelection),
				() => t('room_browser.room_tile.spectate', 'Spectate')
			]
		);

		delegated('click', button, (event) => openProfile(event.currentTarget, $$props.room.host));
		delegated('click', button_2, () => $$props.onJoin($$props.room));
		delegated('click', button_3, () => $$props.onSpectate($$props.room));
		append($$anchor, div);
		pop();
	}

	delegate(['click']);

	var root$1 = from_html(`<span class="badge mono svelte-1c0oecl"> </span>`);
	var root_1$1 = from_html(`<div class="bar svelte-1c0oecl"><button type="button" class="ghost back svelte-1c0oecl"><!> Home</button> <h1 class="svelte-1c0oecl">Rooms</h1> <div class="spacer svelte-1c0oecl"></div> <div class="search svelte-1c0oecl"><!> <label class="sr-only" for="amq-ui-search"> </label> <input id="amq-ui-search" type="text" class="svelte-1c0oecl"/></div> <button type="button"><!> Filters <!></button> <button type="button" class="host svelte-1c0oecl"><!> </button></div>`);

	const $$css$1 = {
		hash: 'svelte-1c0oecl',
		code: '.bar.svelte-1c0oecl {display:flex;align-items:center;gap:16px;height:60px;padding:0 var(--gutter);background:var(--bg-top);border-bottom:1px solid var(--line-soft);}h1.svelte-1c0oecl {margin:0;font-family:var(--font-display);font-size:19px;font-weight:700;letter-spacing:-0.01em;color:#ffffff;}.spacer.svelte-1c0oecl {flex-grow:1;}.ghost.svelte-1c0oecl,\n  .host.svelte-1c0oecl {display:flex;align-items:center;height:36px;border-radius:var(--radius);font-size:13px;font-weight:600;cursor:pointer;}.ghost.svelte-1c0oecl {gap:7px;padding:0 13px;background:var(--bg-raised);border:1px solid rgba(255, 255, 255, 0.12);color:var(--text-2);}.ghost.svelte-1c0oecl:hover {background:rgba(255, 255, 255, 0.12);}.back.svelte-1c0oecl {gap:8px;padding:0 14px 0 10px;}.ghost.open.svelte-1c0oecl {background:rgba(91, 155, 245, 0.2);border-color:rgba(91, 155, 245, 0.5);color:var(--accent-soft);}.badge.svelte-1c0oecl {font-size:11px;font-weight:600;color:#08101c;background:var(--accent);border-radius:5px;padding:1px 6px;}.search.svelte-1c0oecl {display:flex;align-items:center;gap:8px;height:36px;width:268px;padding:0 12px;border-radius:var(--radius);background:var(--bg-sunken);border:1px solid rgba(255, 255, 255, 0.13);color:var(--text-4);}.search.svelte-1c0oecl:focus-within {border-color:var(--accent);}.search.svelte-1c0oecl input:where(.svelte-1c0oecl) {flex-grow:1;min-width:0;background:transparent;border:0;outline:none;color:var(--text);font-family:inherit;font-size:13px;}.host.svelte-1c0oecl {gap:7px;padding:0 16px;background:var(--accent);border:0;color:var(--accent-fg);font-weight:700;}.host.svelte-1c0oecl:hover {background:#6ea8f7;}'
	};

	function TopBar($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css$1);

		var div = root_1$1();
		var button = child(div);
		var node = child(button);

		Icon(node, { name: 'back', size: 15 });

		var div_1 = sibling(button, 6);
		var node_1 = child(div_1);

		Icon(node_1, { name: 'search', size: 15 });

		var label = sibling(node_1, 2);
		var text = only_child(label, true);
		var input = sibling(label, 2);

		var button_1 = sibling(div_1, 2);
		let classes;
		var node_2 = child(button_1);

		Icon(node_2, { name: 'filter', size: 15 });

		var node_3 = sibling(node_2, 2);

		{
			var consequent = ($$anchor) => {
				var span = root$1();
				var text_1 = only_child(span, true);

				template_effect(() => set_text(text_1, $$props.filterCount));
				append($$anchor, span);
			};

			if_block(node_3, ($$render) => {
				if ($$props.filterCount > 0) $$render(consequent);
			});
		}

		var button_2 = sibling(button_1, 2);
		var node_4 = child(button_2);

		Icon(node_4, { name: 'plus', size: 15, strokeWidth: 2.6 });

		var text_2 = sibling(node_4);

		template_effect(
			($0, $1, $2) => {
				set_text(text, $0);
				set_attribute(input, 'placeholder', $1);
				set_value(input, $$props.search);
				classes = set_class(button_1, 1, 'ghost filters svelte-1c0oecl', null, classes, { open: $$props.panelOpen });
				set_attribute(button_1, 'aria-expanded', $$props.panelOpen);
				set_text(text_2, ` ${$2 ?? ''}`);
			},
			[
				() => t('room_browser.filters.search_placeholder', 'Search rooms'),
				() => t('room_browser.filters.search_placeholder', 'Search rooms'),
				() => t('room_browser.host_room', 'Host Room')
			]
		);

		delegated('click', button, function (...$$args) {
			$$props.onBack?.apply(this, $$args);
		});

		delegated('input', input, (event) => $$props.onSearch(event.currentTarget.value));

		delegated('click', button_1, function (...$$args) {
			$$props.onTogglePanel?.apply(this, $$args);
		});

		delegated('click', button_2, function (...$$args) {
			$$props.onHost?.apply(this, $$args);
		});

		append($$anchor, div);
		pop();
	}

	delegate(['click', 'input']);

	var root = from_html(`<div class="empty svelte-gp1rd2"><!></div>`);
	var root_1 = from_html(`<div class="panel-anchor svelte-gp1rd2"><!></div>`);
	var root_2 = from_html(`<div class="screen svelte-gp1rd2" role="presentation"><!> <!> <div class="table svelte-gp1rd2"><!> <div class="list svelte-gp1rd2"></div></div> <!></div>`);

	const $$css = {
		hash: 'svelte-gp1rd2',
		code: '.screen.svelte-gp1rd2 {position:fixed;inset:0;\n    /* AMQ\'s menu bar uses the bottom strip (SPEC §1). */bottom:45px;display:flex;flex-direction:column;overflow:hidden;}.table.svelte-gp1rd2 {flex:1;min-height:0;display:flex;flex-direction:column;margin:0 var(--gutter) var(--gutter);}.list.svelte-gp1rd2 {flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;border-radius:0 0 var(--radius) var(--radius);border:1px solid var(--line-soft);border-top:0;background:var(--bg-list);}.empty.svelte-gp1rd2 {padding:28px var(--gutter);text-align:center;color:var(--text-4);font-size:13px;}.panel-anchor.svelte-gp1rd2 {position:absolute;top:56px;\n    /* Aligns under the Filters button, which is left of Host Room. */right:calc(var(--gutter) + 132px);z-index:60;}'
	};

	function RoomBrowser($$anchor, $$props) {
		push($$props, true);
		append_styles$1($$anchor, $$css);

		let panelOpen = state(false);
		const visible = user_derived(() => sortRooms(roomStore.rooms.filter((room) => filterStore.matches(room)), filterStore.state.sort.key, filterStore.state.sort.dir));

		function back() {
			viewChanger.changeView('main');
		}

		function join(room) {
			roomStore.join(room);
		}

		function spectate(room) {
			roomStore.spectate(room);
		}

		function settings(room) {
			roomStore.previewSettings(room);
		}

		function onKeydown(event) {
			if (event.key === 'Escape' && get(panelOpen)) {
				set(panelOpen, false);
			}
		}

		/**
		 * Stops key events from our text fields from reaching AMQ's document-level
		 * handlers.
		 *
		 * `setup.js:56` blocks Backspace unless `event.target` is an input. An
		 * event that crosses a shadow boundary is retargeted to the host element,
		 * so AMQ sees our wrapper `<div>` and calls `preventDefault()`. Backspace
		 * then does nothing in the search box. Keeping the event inside the shadow
		 * root also keeps AMQ's global shortcuts from firing while the player
		 * types.
		 */
		function keepKeysLocal(event) {
			const target = event.target;
			const tag = target?.tagName;

			if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
				event.stopPropagation();
			}
		}

		var div = root_2();

		event('keydown', $window, onKeydown);

		var node = child(div);

		TopBar(node, {
			get search() {
				return filterStore.search;
			},

			get filterCount() {
				return filterStore.changedCount;
			},

			get panelOpen() {
				return get(panelOpen);
			},
			onSearch: (value) => filterStore.setSearch(value),
			onTogglePanel: () => set(panelOpen, !get(panelOpen)),
			onHost: () => roomStore.host(),
			onBack: back
		});

		var node_1 = sibling(node, 2);

		ActiveFilters(node_1, {
			get chips() {
				return filterStore.activeChips;
			},

			get shown() {
				return get(visible).length;
			},

			get total() {
				return roomStore.roomCount;
			},
			onClearAll: () => filterStore.resetAll()
		});

		var div_1 = sibling(node_1, 2);
		var node_2 = child(div_1);

		ColumnHeader(node_2, {
			get sort() {
				return filterStore.state.sort;
			},
			onSort: (key) => filterStore.setSort(key)
		});

		var div_2 = sibling(node_2, 2);

		each(
			div_2,
			23,
			() => get(visible),
			(room) => room.id,
			($$anchor, room, index) => {
				{
					let $0 = user_derived(() => get(index) % 2 === 1);

					RoomRow($$anchor, {
						get room() {
							return get(room);
						},

						get zebra() {
							return get($0);
						},
						onJoin: join,
						onSpectate: spectate,
						onSettings: settings
					});
				}
			},
			($$anchor) => {
				var div_3 = root();
				var node_3 = child(div_3);

				{
					var consequent = ($$anchor) => {
						var text$1 = text('Loading rooms…');

						append($$anchor, text$1);
					};

					var consequent_1 = ($$anchor) => {
						var text_1 = text('No rooms are open right now.');

						append($$anchor, text_1);
					};

					var alternate = ($$anchor) => {
						var text_2 = text('No rooms match these filters.');

						append($$anchor, text_2);
					};

					if_block(node_3, ($$render) => {
						if (!roomStore.loaded) $$render(consequent); else if (roomStore.roomCount === 0) $$render(consequent_1, 1); else $$render(alternate, -1);
					});
				}
				append($$anchor, div_3);
			}
		);

		var node_4 = sibling(div_1, 2);

		{
			var consequent_2 = ($$anchor) => {
				var div_4 = root_1();
				var node_5 = child(div_4);

				FilterPanel(node_5, {
					get filters() {
						return filterStore;
					},
					onClose: () => set(panelOpen, false)
				});
				append($$anchor, div_4);
			};

			if_block(node_4, ($$render) => {
				if (get(panelOpen)) $$render(consequent_2);
			});
		}
		delegated('keydown', div, keepKeysLocal);
		delegated('keyup', div, keepKeysLocal);
		append($$anchor, div);
		pop();
	}

	delegate(['keydown', 'keyup']);

	const HOST_Z_INDEX = 100;
	let pendingNewQuiz = false;
	const roomBrowserScreen = createScreen({
	  view: "roomBrowser",
	  component: RoomBrowser,
	  props: {},
	  onOpen: () => roomStore.bind(),
	  onClose: () => roomStore.unbind(),
	  zIndex: HOST_Z_INDEX
	});
	const quizBuilderScreen = createScreen({
	  view: "customQuizCreator",
	  component: QuizBuilder,
	  props: {},
	  /**
	   * AMQ's quiz browser calls `setupNewQuiz` right before `changeView` to ask
	   * for a blank quiz (`customQuizBrowser.js:93`). Recording the call lets
	   * `onOpen` tell a new-quiz navigation from a plain re-entry of the view.
	   * `useNew()` re-enters the view and must not wipe the quiz being edited.
	   */
	  extra: (original) => ({
	    setupNewQuiz() {
	      pendingNewQuiz = true;
	      original.setupNewQuiz?.();
	    }
	  }),
	  /**
	   * `changeView('customQuizCreator', { quizLoadId })` carries the quiz to edit.
	   *
	   * The library must be cached before the quiz is read, because entries store
	   * only ids and resolve against it. AMQ nests its own load inside
	   * `library.setup(callback)` for the same reason and silently drops uncached
	   * entries. We refuse the load instead.
	   */
	  onOpen: (arg) => {
	    quizStore.bind();
	    const startingNew = arg?.quizLoadId === void 0;
	    if (startingNew && (pendingNewQuiz || !quizStore.loaded)) {
	      quizStore.startNew();
	    }
	    pendingNewQuiz = false;
	    void libraryStore.load().then((ok) => {
	      if (arg?.quizLoadId === void 0) return;
	      if (!ok) {
	        quizStore.failLoad();
	        return;
	      }
	      quizStore.load(arg.quizLoadId);
	    });
	  },
	  onClose: () => quizStore.unbind(),
	  zIndex: HOST_Z_INDEX
	});
	function liftOverlays() {
	  if (document.head.querySelector("style[data-amq-ui-overlays]")) return;
	  const style = document.createElement("style");
	  style.dataset.amqUiOverlays = "";
	  style.textContent = `#questContainer { z-index: ${HOST_Z_INDEX + 1}; }`;
	  document.head.appendChild(style);
	}
	async function main() {
	  await ensureLoad();
	  installFonts();
	  liftOverlays();
	  roomBrowserScreen.install();
	  quizBuilderScreen.install();
	  exposeDebugApi({
	    useLegacy: roomBrowserScreen.useLegacy,
	    useNew: roomBrowserScreen.useNew,
	    quizBuilderScreen: {
	      useLegacy: quizBuilderScreen.useLegacy,
	      useNew: quizBuilderScreen.useNew
	    }
	  });
	  console.log(
	    "[amq-ui] ready — room browser and quiz builder replaced (__amqUI.useLegacy() / __amqUI.quizBuilder.useLegacy() to revert)"
	  );
	}
	main().catch((error) => {
	  console.error("[amq-ui] failed to start", error);
	  try {
	    roomBrowserScreen.useLegacy();
	    quizBuilderScreen.useLegacy();
	  } catch {
	  }
	  _unsafeWindow.__amqUIFailed = error;
	});

})();