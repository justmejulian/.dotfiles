local M = {}

-- Launch, focus, or rotate windows of an application.
-- If the app is already focused, cycles to the last window in the stack.
function M.launchOrFocusOrRotate(app)
	local focusedWindow = hs.window.focusedWindow()
	if focusedWindow and focusedWindow:application():name() == app then
		local appBundleID = focusedWindow:application():bundleID()
		local appWindows = hs.application.get(appBundleID):allWindows()
		if #appWindows > 0 then
			appWindows[#appWindows]:focus()
		else
			hs.application.launchOrFocus(app)
		end
	else
		hs.application.launchOrFocus(app)
	end
end

return M
