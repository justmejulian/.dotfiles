local M = {}

function M.maximize()
	local win = hs.window.focusedWindow()
	if win then
		win:maximize()
	end
end

function M.snapLeft()
	local win = hs.window.focusedWindow()
	if win then
		local f = win:screen():frame()
		win:setFrame({ x = f.x, y = f.y, w = f.w / 2, h = f.h })
	end
end

function M.snapRight()
	local win = hs.window.focusedWindow()
	if win then
		local f = win:screen():frame()
		win:setFrame({ x = f.x + f.w / 2, y = f.y, w = f.w / 2, h = f.h })
	end
end

-- n = 1 (left), 2 (middle), 3 (right)
function M.snapThird(n)
	local win = hs.window.focusedWindow()
	if win then
		local f = win:screen():frame()
		win:setFrame({ x = f.x + (f.w / 3) * (n - 1), y = f.y, w = f.w / 3, h = f.h })
	end
end

function M.moveToNextScreen()
	local win = hs.window.focusedWindow()
	if win then
		win:moveToScreen(win:screen():next())
		win:maximize()
	end
end

return M
