local ipc = require 'hs.ipc'

hs.autoLaunch(true)
hs.consoleOnTop(false)
hs.dockIcon(false)
hs.menuIcon(true)

local binPath = '/opt/homebrew'
if ipc.cliStatus(binPath) then
  print 'Hammerspoon cli already loaded'
else
  ipc.cliUninstall(binPath, false) -- clean up
  if ipc.cliInstall(binPath, false) then
    print 'Loaded Hammerspoon Cli'
    -- can be used like this:
    -- hs -c "hs.alert.show('Hello, world!')"
  else
    print 'Failed to load Hammerspoon cli'
  end
end

local summon = require 'modules.summon'
local windows = require 'modules.windows'
local spaces = require 'modules.spaces'
local screenWatcher = require 'modules.screen_watcher'
local layouts = require 'modules.layouts'
local awAway = require 'modules.aw_away'

-- Using https://hyperkey.app/
local hyper = { 'cmd', 'alt', 'ctrl' }
local cmdalt = { 'cmd', 'alt' }
local cmdaltshift = { 'cmd', 'alt', 'shift' }

-- summon key → app name
local apps = {
  m = 'Slack', -- messages
  o = 'Obsidian',
  i = 'Google Chrome', -- internet
  -- i = 'Glide', -- internet
  k = 'Ghostty',
  f = 'Finder',
  b = 'Bitwarden',
  g = 'GitHub Dashboard',
  a = 'abtop',
  h = 'Herdr', -- herd agents
  l = 'Linear',
  v = 'Foxglove', -- visualization
}

-- Layouts
layouts.register('maximize_all', function(_screens)
  for _, win in ipairs(hs.window.visibleWindows()) do
    if win:isStandard() then
      win:maximize()
    end
  end
end)

layouts.register('ghostty_right', function(_screens)
  for _, win in ipairs(hs.window.visibleWindows()) do
    if win:isStandard() and not win:isFullScreen() then
      local app = win:application()
      if app and app:name() == 'Ghostty' then
        windows.snapRight(win)
      end
    end
  end
end)

layouts.register('non_ghostty_left', function(_screens)
  local secondary = layouts.screenByName 'LG HDR WQHD'
  if not secondary then
    return
  end

  for _, win in ipairs(hs.window.visibleWindows()) do
    if win:isStandard() and not win:isFullScreen() and win:screen():id() == secondary:id() then
      local app = win:application()
      if app and app:name() ~= 'Ghostty' then
        windows.snapLeft(win)
      end
    end
  end
end)

layouts.register('move_ghostty_to_secondary', function(_screens)
  local secondary = layouts.externalScreen()
  if not secondary then
    return
  end

  -- Find the space Ghostty lives on
  local ghosttySpaceID = nil
  for _, win in ipairs(hs.window.allWindows()) do
    local app = win:application()
    if app and app:name() == 'Ghostty' then
      local winSpaces = hs.spaces.windowSpaces(win)
      if winSpaces and #winSpaces > 0 then
        ghosttySpaceID = winSpaces[1]
        break
      end
    end
  end

  if not ghosttySpaceID then
    return
  end

  -- Move all windows on that space to secondary screen
  for _, win in ipairs(hs.window.allWindows()) do
    if win:isStandard() and not win:isFullScreen() then
      local winSpaces = hs.spaces.windowSpaces(win)
      if winSpaces then
        for _, spaceID in ipairs(winSpaces) do
          if spaceID == ghosttySpaceID then
            win:moveToScreen(secondary)
            break
          end
        end
      end
    end
  end
end)

-- Auto-apply layouts on screen change
screenWatcher.onChange(function(screens)
  if #screens == 1 then
    layouts.apply 'maximize_all'
  else
    for _, s in ipairs(screens) do
      if s:name() == 'LG HDR WQHD' then
        layouts.apply 'move_ghostty_to_secondary'
        layouts.apply 'ghostty_right'
        layouts.apply 'non_ghostty_left'
        return
      end
      if s:name() == 'DELL P2421D' then
        layouts.apply 'move_ghostty_to_secondary'
        layouts.apply 'maximize_all'
        return
      end
    end
  end
end)

screenWatcher.start()

-- Highlight the focused Screen Sharing window without intercepting clicks.
local screenSharingBorder = hs.canvas.new { x = 0, y = 0, w = 1, h = 1 }
screenSharingBorder:level(hs.canvas.windowLevels.overlay)
screenSharingBorder:behavior { 'canJoinAllSpaces', 'fullScreenAuxiliary', 'stationary' }
screenSharingBorder:clickActivating(false)
screenSharingBorder:canvasMouseEvents(false, false, false, false)
screenSharingBorder[1] = {
  type = 'rectangle',
  action = 'stroke',
  strokeColor = { hex = '#664fff', alpha = 1 },
  strokeWidth = 4,
  frame = { x = 2, y = 2, w = 1, h = 1 },
}

local function updateScreenSharingBorder()
  local win = hs.window.focusedWindow()
  local app = win and win:application()
  if not app or app:bundleID() ~= 'com.apple.ScreenSharing' then
    screenSharingBorder:hide()
    return
  end

  local frame = win:frame()
  if frame.w <= 4 or frame.h <= 4 then
    screenSharingBorder:hide()
    return
  end

  screenSharingBorder:frame(frame)
  screenSharingBorder[1].frame = { x = 2, y = 2, w = frame.w - 4, h = frame.h - 4 }
  screenSharingBorder:show()
end

-- Polling also follows resizing, fullscreen transitions, and Space changes.
screenSharingBorderTimer = hs.timer.doEvery(0.1, updateScreenSharingBorder)
updateScreenSharingBorder()

-- Release local shortcuts while Screen Sharing is frontmost.
local hotkeys = {}

-- Set { keepInScreenSharing = true } as the fourth argument to reserve a
-- combination locally, even while controlling the remote Mac.
local function bind(modifiers, key, callback, options)
  local hotkey = hs.hotkey.bind(modifiers, key, callback)
  table.insert(hotkeys, {
    hotkey = hotkey,
    keepInScreenSharing = options and options.keepInScreenSharing or false,
  })
  return hotkey
end

local function updateHotkeys()
  local app = hs.application.frontmostApplication()
  local isScreenSharing = app and app:bundleID() == 'com.apple.ScreenSharing'

  for _, binding in ipairs(hotkeys) do
    if isScreenSharing and not binding.keepInScreenSharing then
      binding.hotkey:disable()
    else
      binding.hotkey:enable()
    end
  end
end

screenSharingWatcher = hs.application.watcher.new(function(_, event)
  if event == hs.application.watcher.activated then
    updateHotkeys()
    updateScreenSharingBorder()
  end
end)
screenSharingWatcher:start()

-- Shortcuts reserved for the host, including during Screen Sharing.
bind(hyper, 'd', function()
  hs.application.launchOrFocusByBundleID 'com.apple.ScreenSharing'
end, { keepInScreenSharing = true })

bind(hyper, 'escape', function()
  local app = hs.application.frontmostApplication()
  if app and app:bundleID() == 'com.apple.ScreenSharing' then
    app:hide()
  end
  hs.spaces.toggleShowDesktop()
end, { keepInScreenSharing = true })

-- Reload config
bind(hyper, 'r', hs.reload)

-- App summon: launch, focus, or rotate windows
for key, name in pairs(apps) do
  bind(hyper, key, function()
    summon.launchOrFocusOrRotate(name)
  end, { keepInScreenSharing = key == 'm' })
end

-- Cycle between Claude and ChatGPT
bind(hyper, 'c', function()
  summon.cycleApps { 'Claude', 'ChatGPT' }
end)

-- Toggle Notification Center with Globe+N after releasing Hyper.
bind(hyper, 'n', function()
  hs.timer.waitUntil(function()
    local mods = hs.eventtap.checkKeyboardModifiers()
    return not (mods.cmd or mods.alt or mods.ctrl or mods.shift)
  end, function()
    for _, isDown in ipairs { true, false } do
      local event = hs.eventtap.event.newKeyEvent('n', isDown)
      event:setFlags { fn = true }
      event:post()
    end
  end, 0.02)
end)

-- Toggle Control Center with Globe+C after releasing Hyper.
bind(hyper, 's', function()
  hs.timer.waitUntil(function()
    local mods = hs.eventtap.checkKeyboardModifiers()
    return not (mods.cmd or mods.alt or mods.ctrl or mods.shift)
  end, function()
    for _, isDown in ipairs { true, false } do
      local event = hs.eventtap.event.newKeyEvent('c', isDown)
      event:setFlags { fn = true }
      event:post()
    end
  end, 0.02)
end)

-- Window sizing
bind(cmdalt, 'return', windows.maximize)
bind(cmdalt, 'left', windows.snapLeft)
bind(cmdalt, 'right', windows.snapRight)
bind(cmdalt, '1', function()
  windows.snapThird(1)
end)
bind(cmdalt, '2', function()
  windows.snapThird(2)
end)
bind(cmdalt, '3', function()
  windows.snapThird(3)
end)

-- Two-thirds width, anchored to either side
bind(cmdalt, '4', function()
  windows.snapTwoThirds 'left'
end)
bind(cmdalt, '5', function()
  windows.snapTwoThirds 'right'
end)

-- Move window to next screen (and maximize)
bind(cmdalt, 'm', windows.moveToNextScreen)

-- Move window between spaces
bind(cmdalt, 'n', function()
  spaces.moveWindowToSpace 'next'
end)
bind(cmdaltshift, 'n', function()
  spaces.moveWindowToSpace 'prev'
end)

updateHotkeys()

-- ActivityWatch: ask what I was doing after AFK periods
awAway.start()
