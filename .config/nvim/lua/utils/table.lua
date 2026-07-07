-- Return a new list with duplicates removed, preserving first-seen order.
local function unique(list)
  local seen, result = {}, {}
  for _, item in ipairs(list or {}) do
    if not seen[item] then
      seen[item] = true
      result[#result + 1] = item
    end
  end
  return result
end

return {
  unique = unique,
}
