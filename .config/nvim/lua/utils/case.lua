local function to_pascal_case(str)
  return str:gsub('(%a[%w%-]*)', function(segment)
    return segment
      :gsub('-(%a)', function(letter)
        return letter:upper() -- Capitalize the letter after hyphen
      end)
      :gsub('^%l', string.upper) -- Capitalize the first letter
  end)
end

return {
  to_pascal_case = to_pascal_case,
}
