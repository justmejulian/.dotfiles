local ipc = require("hs.ipc")

hs.autoLaunch(true)
hs.consoleOnTop(false)
hs.dockIcon(false)
hs.menuIcon(true)

local binPath = '/opt/homebrew'
if ipc.cliStatus(binPath) then
  print("Hammerspoon cli already loaded")
else
  ipc.cliUninstall(binPath, false) -- clean up
  if ipc.cliInstall(binPath, false) then
    print("Loaded Hammerspoon Cli")
    -- can be used like this
    -- hs -c "hs.alert.show('Hello, world!')"
  else
    print("Failed to load Hammerspoon cli")
  end
end

-- Using https://hyperkey.app/
local hyper = { "cmd", "alt", "ctrl" }        -- Hyper key
local cmdalt = { "cmd", "alt" }               -- Hyper key
local cmdaltshift = { "cmd", "alt", "shift" } -- Hyper key

hs.hotkey.bind(hyper, 'r', function() hs.reload() end)

local apps = {
  {
    name = 'Slack',
    summonKey = 'm', -- m for "messages"
  },
  {
    name = 'Obsidian',
    summonKey = 'o',
  },
  {
    name = 'Google Chrome',
    summonKey = 'i', -- i for "internet"
  },
  -- {
  --   name = 'Safari',
  --   summonKey = 'i',
  -- },
  {
    name = 'Ghostty',
    summonKey = 'k',
  },
  {
    name = 'xCode',
    summonKey = 'x',
  },
  {
    name = 'Docker',
    summonKey = 'd',
  },
  {
    name = 'Finder',
    summonKey = 'f',
  },
  {
    name = 'Docker Desktop',
    summonKey = 'd',
  },
  {
    name = 'ChatGPT',
    summonKey = 'c',
  },
  {
    name = 'Bitwarden',
    summonKey = 'b',
  },
  {
    name = 'Intellij IDEA',
    summonKey = 'j',
  }
}

-- hs.fnutils.each(apps, function(app)
--   hs.hotkey.bind(hyper, app.summonKey, function()
--     hs.application.launchOrFocus(app.name)
--   end)
-- end)

-- launch, focus or rotate application
local function launchOrFocusOrRotate(app)
  local focusedWindow = hs.window.focusedWindow()
  -- If already focused, try to find the next window
  if focusedWindow and focusedWindow:application():name() == app then
    local appBundleID = focusedWindow:application():bundleID()
    local appWindows = hs.application.get(appBundleID):allWindows()
    if #appWindows > 0 then
      -- It seems that this list order changes after one window get focused,
      -- let's directly bring the last one to focus every time
      appWindows[#appWindows]:focus()
    else -- this should not happen, but just in case
      hs.application.launchOrFocus(app)
    end
  else -- if not focused
    hs.application.launchOrFocus(app)
  end
end

hs.fnutils.each(apps, function(app)
  hs.hotkey.bind(hyper, app.summonKey, function()
    launchOrFocusOrRotate(app.name)
  end)
end)

-- Move between windows
hs.hotkey.bind(hyper, 'h', function() hs.window.focusedWindow():focusWindowWest() end)
hs.hotkey.bind(hyper, 'l', function() hs.window.focusedWindow():focusWindowEast() end)
-- hs.hotkey.bind(cmdalt, 'j', function() hs.window.focusedWindow():focusWindowNorth() end)
-- hs.hotkey.bind(cmdalt, 'k', function() hs.window.focusedWindow():focusWindowSouth() end)

-- Move window to next screen
hs.hotkey.bind(cmdalt, 'm', function()
  local app = hs.window.focusedWindow()
  app:moveToScreen(app:screen():next())
  app:maximize()
end)

local function getLastSpaceIndex(spaces, cur_space_id)
  for index, space in pairs(spaces) do
    if space == cur_space_id then
      return index - 1
    end
  end
end

local function getNextSpaceIndex(spaces, cur_space_id)
  for index, space in pairs(spaces) do
    if space == cur_space_id then
      return index + 1
    end
  end
end

local function getSpaceIdByIndex(index, spaces, cur_screen_id)
  if index < 1 then
    return
  end
  if index > #spaces then
    hs.spaces.addSpaceToScreen(cur_screen_id)
    local all_spaces = hs.spaces.allSpaces()
    local cur_screen_spaces = all_spaces[cur_screen_id]
    return cur_screen_spaces[index]
  end
  return spaces[index]
end

local function moveWindowToNextSpace()
  local win = hs.window.focusedWindow() -- current window
  local cur_screen = hs.screen.mainScreen()
  local cur_screen_id = cur_screen:getUUID()
  local cur_space_id = hs.spaces.activeSpaceOnScreen(cur_screen_id)
  local all_spaces = hs.spaces.allSpaces()
  local cur_screen_spaces = all_spaces[cur_screen_id]
  local next_space_index = getNextSpaceIndex(cur_screen_spaces, cur_space_id)
  local next_space_id = getSpaceIdByIndex(next_space_index, cur_screen_spaces, cur_screen_id)
  hs.spaces.moveWindowToSpace(win:id(), next_space_id) -- move window to next space
  hs.spaces.gotoSpace(next_space_id)                   -- move to next space
end

local function moveWindowToLastSpace()
  local win = hs.window.focusedWindow() -- current window
  local cur_screen = hs.screen.mainScreen()
  local cur_screen_id = cur_screen:getUUID()
  local cur_space_id = hs.spaces.activeSpaceOnScreen(cur_screen_id)
  local all_spaces = hs.spaces.allSpaces()
  local cur_screen_spaces = all_spaces[cur_screen_id]
  local last_space_index = getLastSpaceIndex(cur_screen_spaces, cur_space_id)
  local last_space_id = getSpaceIdByIndex(last_space_index, cur_screen_spaces, cur_screen_id)
  hs.spaces.moveWindowToSpace(win:id(), last_space_id)
  hs.spaces.gotoSpace(last_space_id)
end

hs.hotkey.bind(cmdalt, 'n', function() moveWindowToNextSpace() end)
hs.hotkey.bind(cmdaltshift, 'n', function() moveWindowToLastSpace() end)

-- local function closeCurrentSpace()
--   local cur_screen = hs.screen.mainScreen()
--   local cur_screen_id = cur_screen:getUUID()
--   local cur_space_id = hs.spaces.activeSpaceOnScreen(cur_screen_id)
--   local all_spaces = hs.spaces.allSpaces()
--   local cur_screen_spaces = all_spaces[cur_screen_id]
--   local last_space_index = getLastSpaceIndex(cur_screen_spaces, cur_space_id)
--   local last_space_id = getSpaceIdByIndex(last_space_index, cur_screen_spaces, cur_screen_id)
--   hs.spaces.gotoSpace(last_space_id)
--   hs.spaces.removeSpace(cur_space_id)
-- end
-- hs.hotkey.bind(cmdalt, 'c', function() closeCurrentSpace() end)
