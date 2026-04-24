local M = {}

local function getSpaceIndex(spaces, cur_space_id)
	for index, space in pairs(spaces) do
		if space == cur_space_id then
			return index
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
		return all_spaces[cur_screen_id][index]
	end
	return spaces[index]
end

-- dir = "next" or "prev"
function M.moveWindowToSpace(dir)
	local win = hs.window.focusedWindow()
	if not win then
		return
	end
	local cur_screen_id = hs.screen.mainScreen():getUUID()
	local cur_space_id = hs.spaces.activeSpaceOnScreen(cur_screen_id)
	local cur_spaces = hs.spaces.allSpaces()[cur_screen_id]
	local cur_index = getSpaceIndex(cur_spaces, cur_space_id)
	local target_index = dir == "next" and cur_index + 1 or cur_index - 1
	local target_space = getSpaceIdByIndex(target_index, cur_spaces, cur_screen_id)
	if not target_space then
		return
	end
	hs.spaces.moveWindowToSpace(win:id(), target_space)
	hs.spaces.gotoSpace(target_space)
end

return M
