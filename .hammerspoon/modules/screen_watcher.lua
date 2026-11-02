local M = {}

M._callbacks = {}
M._watcher = nil
M._timer = nil
M._lastSignature = nil

function M.onChange(fn)
  table.insert(M._callbacks, fn)
end

-- Sorted screen UUIDs, so we can tell real plug/unplug events apart from
-- visible-frame changes (e.g. the auto-hidden Dock sliding in during Mission
-- Control), which hs.screen.watcher also reports.
local function signature(screens)
  local ids = {}
  for _, s in ipairs(screens) do
    table.insert(ids, s:getUUID())
  end
  table.sort(ids)
  return table.concat(ids, ',')
end

local function fire(reason)
  local screens = hs.screen.allScreens()
  local names = {}
  for _, s in ipairs(screens) do
    table.insert(names, s:name())
  end
  local sig = signature(screens)
  if reason ~= 'start' and sig == M._lastSignature then
    print('screen_watcher: skipping (' .. reason .. '), screens unchanged: ' .. table.concat(names, ', '))
    return
  end
  M._lastSignature = sig
  print('screen_watcher: firing (' .. reason .. '), screens: ' .. table.concat(names, ', '))
  for _, fn in ipairs(M._callbacks) do
    fn(screens)
  end
end

function M.start()
  M._watcher = hs.screen.watcher.new(function()
    if M._timer then M._timer:stop() end
    M._timer = hs.timer.doAfter(1, function()
      fire 'screen change'
    end)
  end)
  M._watcher:start()
  fire 'start'
end

function M.stop()
  if M._watcher then
    M._watcher:stop()
    M._watcher = nil
  end
  if M._timer then
    M._timer:stop()
    M._timer = nil
  end
end

return M
