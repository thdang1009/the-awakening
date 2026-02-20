// ---------------------------------------------------------------------------
// DateTime Context — reads local clock to produce dynamic game modifiers
// ---------------------------------------------------------------------------

export interface GameContext {
  isNight:     boolean   // 22:00 – 05:59 local time
  isWeekend:   boolean   // Saturday (6) or Sunday (0)
  isHalloween: boolean   // Oct 31
  isNewYear:   boolean   // Jan 1
  hour:        number    // 0-23
  dayOfWeek:   number    // 0=Sun … 6=Sat
  /** Human-readable HUD label for the active context event, empty if none */
  eventLabel:  string
  /** HUD label hex color string */
  eventColor:  string
}

export function detectContext(): GameContext {
  const now        = new Date()
  const hour       = now.getHours()
  const dayOfWeek  = now.getDay()
  const month      = now.getMonth() + 1  // 1-based
  const dayOfMonth = now.getDate()

  const isNight     = hour >= 22 || hour < 6
  const isWeekend   = dayOfWeek === 0 || dayOfWeek === 6
  const isHalloween = month === 10 && dayOfMonth === 31
  const isNewYear   = month === 1  && dayOfMonth === 1

  let eventLabel = ''
  let eventColor = '#ffffff'

  // Priority: special dates > weekend > night
  if (isNewYear) {
    eventLabel = '[NEW YEAR]'
    eventColor = '#00ffcc'
  } else if (isHalloween) {
    eventLabel = '[HALLOWEEN]'
    eventColor = '#ff8800'
  } else if (isWeekend && isNight) {
    eventLabel = '[NIGHT  WEEKEND]'
    eventColor = '#cc88ff'
  } else if (isNight) {
    eventLabel = '[NIGHT]'
    eventColor = '#aa88ff'
  } else if (isWeekend) {
    eventLabel = '[WEEKEND]'
    eventColor = '#ffdd00'
  }

  return { isNight, isWeekend, isHalloween, isNewYear, hour, dayOfWeek, eventLabel, eventColor }
}
