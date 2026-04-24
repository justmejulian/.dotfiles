local M = {}

M._layouts = {}
M._watcher = nil

function M.addLayout(layout)
  table.insert(M._layouts, layout)
end

function M.externalScreens()
  local primary = hs.screen.primaryScreen()
  local result = {}
  for _, s in ipairs(hs.screen.allScreens()) do
    if s:id() ~= primary:id() then
      table.insert(result, s)
    end
  end
  return result
end

function M.externalScreen()
  return M.externalScreens()[1]
end

function M.screenByName(name)
  for _, s in ipairs(hs.screen.allScreens()) do
    if s:name() == name then
      return s
    end
  end
  return nil
end

function M.apply()
  local screens = hs.screen.allScreens()
  for _, layout in ipairs(M._layouts) do
    if layout.match(screens) then
      layout.apply(screens)
      return
    end
  end
end

function M.start()
  M._watcher = hs.screen.watcher.new(function()
    hs.timer.doAfter(1, M.apply)
  end)
  M._watcher:start()
  M.apply()
end

function M.stop()
  if M._watcher then
    M._watcher:stop()
    M._watcher = nil
  end
end

return M
