local M = {}

M._callbacks = {}
M._watcher = nil
M._timer = nil

function M.onChange(fn)
  table.insert(M._callbacks, fn)
end

local function fire()
  local screens = hs.screen.allScreens()
  for _, fn in ipairs(M._callbacks) do
    fn(screens)
  end
end

function M.start()
  M._watcher = hs.screen.watcher.new(function()
    if M._timer then M._timer:stop() end
    M._timer = hs.timer.doAfter(1, fire)
  end)
  M._watcher:start()
  fire()
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
