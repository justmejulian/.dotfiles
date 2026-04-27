local M = {}

-- Parse output of `revu comments`:
--
--   [active] /path/to/file:42
--   REVU[179131] @Author: text
--   REVU[179131]   continuation
--
-- Returns list of { id, status, path, lnum, lines }
function M.parse_comments(output)
  local threads = {}
  local current = nil

  for _, line in ipairs(vim.split(output, '\n')) do
    local status, path, lnum = line:match '^%[(%w+)%] (/[^:]+):(%d+)'
    if status and path and lnum then
      if current then
        table.insert(threads, current)
      end
      current = { id = nil, status = status, path = path, lnum = tonumber(lnum), lines = {} }
    elseif current then
      if line ~= '' then
        local id, text = line:match '^REVU%[(%d+)%] (.+)'
        if id then
          current.id = current.id or id
          table.insert(current.lines, text)
        else
          local cont = line:match '^REVU%[%d+%]%s*(.*)'
          if cont and cont ~= '' then
            table.insert(current.lines, '  ' .. cont)
          end
        end
      end
    end
  end

  if current then
    table.insert(threads, current)
  end

  return threads
end

return M
