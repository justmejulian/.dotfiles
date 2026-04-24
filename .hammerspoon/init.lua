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
local screenLayouts = require 'modules.screen_layouts'

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

-- Screen layouts: auto-apply on monitor connect/disconnect
screenLayouts.addLayout {
  name = 'laptop_only',
  match = function(screens) return #screens == 1 end,
  apply = function(_screens)
    for _, win in ipairs(hs.window.visibleWindows()) do
      if win:isStandard() then
        win:maximize()
      end
    end
  end,
}

screenLayouts.addLayout {
  name = 'lg_wqhd',
  match = function(screens)
    for _, s in ipairs(screens) do
      if s:name() == 'LG HDR WQHD' then return true end
    end
    return false
  end,
  apply = function(_screens)
    local lg = screenLayouts.screenByName('LG HDR WQHD')
    for _, win in ipairs(hs.window.visibleWindows()) do
      if win:isStandard() and not win:isFullScreen() then
        local app = win:application()
        win:moveToScreen(lg)
        if app and app:name() == 'Ghostty' then
          windows.snapRight(win)
        else
          windows.snapLeft(win)
        end
      end
    end
  end,
}

screenLayouts.start()

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
