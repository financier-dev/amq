/**
 * Disables the AFK kicker by replacing the methods that start its timers.
 *
 * AMQ starts the first AFK timer before this script runs. The replacements
 * must clear the timers, or that first timer shows the warning 30 minutes
 * after login.
 */
export default async function setup() {
  AfkKicker.prototype.setupAfkTimeout = function () {
    clearTimeout(this.afkWarningTimeout)
  }
  AfkKicker.prototype.setupHostTimeout = function () {
    this.clearHostTimeout()
  }

  // `afkKicker` is a `let` in the client, so the userscript sandbox may not
  // see it. Without it, the first click or key press clears the timers.
  if (typeof afkKicker !== 'undefined') {
    afkKicker.setupAfkTimeout()
    afkKicker.setupHostTimeout()
  }
}
