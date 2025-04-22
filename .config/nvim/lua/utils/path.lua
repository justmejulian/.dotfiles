function get_absolute_path()
  return vim.fn.expand '%:p'
end

function get_relative_path()
  return vim.fn.expand '%:.'
end

return {
  get_absolute_path = get_absolute_path,
  get_relative_path = get_relative_path,
}
