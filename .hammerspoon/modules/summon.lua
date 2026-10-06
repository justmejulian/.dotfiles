local M = {}

-- Track when each app was last activated, so cycleApps can return to the
-- most recently used one.
local lastActivated = {}
M.activationWatcher = hs.application.watcher.new(function(name, event)
  if event == hs.application.watcher.activated and name then
    lastActivated[name] = hs.timer.absoluteTime()
  end
end)
M.activationWatcher:start()

-- Launch or focus the next app in a list, cycling forward each time the
-- current app is one of the list. Otherwise jumps to the most recently
-- focused app in the list, falling back to the first.
function M.cycleApps(apps)
  local focusedWindow = hs.window.focusedWindow()
  local focusedApp = focusedWindow and focusedWindow:application():name()

  local currentIndex
  for i, name in ipairs(apps) do
    if name == focusedApp then
      currentIndex = i
      break
    end
  end

  local nextApp
  if currentIndex then
    nextApp = apps[(currentIndex % #apps) + 1]
  else
    nextApp = apps[1]
    local latest = lastActivated[nextApp] or 0
    for _, name in ipairs(apps) do
      if (lastActivated[name] or 0) > latest then
        nextApp = name
        latest = lastActivated[name]
      end
    end
  end

  hs.application.launchOrFocus(nextApp)
end

-- Launch, focus, or rotate windows of an application.
-- If the app is already focused, cycles to the last window in the stack.
function M.launchOrFocusOrRotate(app)
  local focusedWindow = hs.window.focusedWindow()
  if focusedWindow and focusedWindow:application():name() == app then
    local appBundleID = focusedWindow:application():bundleID()
    local appWindows = hs.application.get(appBundleID):allWindows()
    if #appWindows > 0 then
      appWindows[#appWindows]:focus()
    else
      hs.application.launchOrFocus(app)
    end
  else
    hs.application.launchOrFocus(app)
  end
end

return M
