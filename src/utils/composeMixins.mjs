/**
 * Composes multiple mixin functions into a single mixin function.
 * This allows for the combination of multiple behaviors into a single class.
 *
 * @param {...Function} mixins - The mixin functions to be composed.
 * @returns {Function} A composed mixin function that applies all provided mixins to a base class.
 *
 * @example
 * // Define two simple mixin functions
 * const GreetingMixin = (Base) => class extends Base {
 *   greet() {
 *     console.log('Hello')
 *   }
 * }
 *
 * const FarewellMixin = (Base) => class extends Base {
 *   farewell() {
 *     console.log('Goodbye')
 *   }
 * }
 *
 * // Compose the mixins into one
 * const ComposedMixin = composeMixins(GreetingMixin, FarewellMixin)
 *
 * // Apply the composed mixin to a class
 * class Person extends ComposedMixin(Object) {}
 * const person = new Person()
 * person.greet()    // Output: Hello
 * person.farewell() // Output: Goodbye
 */
export const composeMixins = (...mixins) => (Base) => mixins.reduce((acc, mixin) => mixin(acc), Base)
