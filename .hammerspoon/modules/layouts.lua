local M = {}

M._layouts = {}

function M.register(name, fn)
  M._layouts[name] = fn
end

function M.apply(name)
  local fn = M._layouts[name]
  if fn then
    fn(hs.screen.allScreens())
  else
    print('layouts: unknown layout: ' .. tostring(name))
  end
end

function M.list()
  local names = {}
  for name, _ in pairs(M._layouts) do
    table.insert(names, name)
  end
  return names
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

return M
