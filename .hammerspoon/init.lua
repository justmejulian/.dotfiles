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

-- Using https://hyperkey.app/
local hyper = { 'cmd', 'alt', 'ctrl' }
local cmdalt = { 'cmd', 'alt' }
local cmdaltshift = { 'cmd', 'alt', 'shift' }

-- summon key → app name
local apps = {
  m = 'Slack', -- messages
  o = 'Obsidian',
  i = 'Glide', -- internet
  k = 'Ghostty',
  x = 'xCode',
  f = 'Finder',
  c = 'Claude',
  b = 'Bitwarden',
  j = 'Intellij IDEA',
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

layouts.register('move_ghostty_to_secondary', function(_screens)
  local secondary = layouts.externalScreen()
  if not secondary then return end
  for _, win in ipairs(hs.window.visibleWindows()) do
    if win:isStandard() and not win:isFullScreen() then
      local app = win:application()
      if app and app:name() == 'Ghostty' then
        win:moveToScreen(secondary)
      end
    end
  end
end)

-- Auto-apply layouts on screen change
screenWatcher.onChange(function(screens)
  if #screens == 1 then
    layouts.apply('maximize_all')
  else
    for _, s in ipairs(screens) do
      if s:name() == 'LG HDR WQHD' then
        layouts.apply('move_ghostty_to_secondary')
        layouts.apply('ghostty_right')
        return
      end
    end
  end
end)

screenWatcher.start()

-- Reload config
hs.hotkey.bind(hyper, 'r', hs.reload)

-- App summon: launch, focus, or rotate windows
for key, name in pairs(apps) do
  hs.hotkey.bind(hyper, key, function()
    summon.launchOrFocusOrRotate(name)
  end)
end

-- Move focus between windows
hs.hotkey.bind(hyper, 'h', function()
  local w = hs.window.focusedWindow()
  if w then
    w:focusWindowWest()
  end
end)
hs.hotkey.bind(hyper, 'l', function()
  local w = hs.window.focusedWindow()
  if w then
    w:focusWindowEast()
  end
end)

-- Window sizing
hs.hotkey.bind(cmdalt, 'return', windows.maximize)
hs.hotkey.bind(cmdalt, 'left', windows.snapLeft)
hs.hotkey.bind(cmdalt, 'right', windows.snapRight)
hs.hotkey.bind(cmdalt, '1', function()
  windows.snapThird(1)
end)
hs.hotkey.bind(cmdalt, '2', function()
  windows.snapThird(2)
end)
hs.hotkey.bind(cmdalt, '3', function()
  windows.snapThird(3)
end)

-- Move window to next screen (and maximize)
hs.hotkey.bind(cmdalt, 'm', windows.moveToNextScreen)

-- Move window between spaces
hs.hotkey.bind(cmdalt, 'n', function()
  spaces.moveWindowToSpace 'next'
end)
hs.hotkey.bind(cmdaltshift, 'n', function()
  spaces.moveWindowToSpace 'prev'
end)
