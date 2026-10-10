/** Disables the AFK kicker by replacing the methods that start its timers. */
export default async function setup() {
  AfkKicker.prototype.setupAfkTimeout = () => {}
  AfkKicker.prototype.setupHostTimeout = () => {}
}
