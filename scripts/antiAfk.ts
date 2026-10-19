/**
 * Disables the AFK kicker by replacing the methods that start its timers.
 *
 * AMQ starts the first AFK timer in `afkKicker.setup()`, during login. The
 * methods must be replaced before that, so this script uses `beforeLoad`:
 * `ensureLoad` resolves only after login, when the timer already runs.
 */
export function beforeLoad() {
  AfkKicker.prototype.setupAfkTimeout = function () {
    clearTimeout(this.afkWarningTimeout)
  }
  AfkKicker.prototype.setupHostTimeout = function () {
    this.clearHostTimeout()
  }
}

export default async function setup() {}
