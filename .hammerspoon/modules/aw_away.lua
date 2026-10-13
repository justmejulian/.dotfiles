-- Ask what I was doing after ActivityWatch detects an AFK period, in a small
-- webview dialog (hs.dialog blocks Hammerspoon and binds Escape to its second button):
--   "I was here"           → rewrite the AFK event as not-afk, so the focused app counts
--   "Save" (Enter) + text  → keep it as AFK and add the text as the reason on the AFK event
--   "Save" empty           → keep it as AFK
--   "Cancel" (Escape)      → keep it as AFK
-- Sleep needs no separate prompt: the screen locks on sleep, so the AFK watcher
-- is already AFK and its event spans the sleep.
local M = {}

M.api = 'http://127.0.0.1:5600/api/0'
M.minAway = 3 * 60 -- only ask about AFK periods at least this long (seconds); matches aw-watcher-afk's timeout
M.maxAge = 15 * 60 -- ignore AFK periods that ended longer ago than this
M.pollInterval = 10

M._timer = nil
M._host = nil
M._prompting = false
M._askTimer = nil
M._dialog = nil

local json = { ['Content-Type'] = 'application/json' }
local settingsKey = 'aw_away.lastAskedId'

local function afkBucket()
  return 'aw-watcher-afk_' .. M._host
end

-- AW timestamps look like 2026-10-12T11:28:46.189000+00:00 (always UTC)
local function parseUtc(ts)
  local y, mo, d, h, mi, s = ts:match '(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)'
  local fields = { year = y, month = mo, day = d, hour = h, min = mi, sec = s, isdst = false }
  local now = os.time()
  local offset = os.difftime(now, os.time(os.date('!*t', now)))
  return os.time(fields) + offset
end

local function logError(what, status, body)
  print(string.format('aw_away: %s failed (%s): %s', what, tostring(status), tostring(body)))
end

-- Replace the AFK event in place (same id) with new data
local function rewrite(bucket, event, data)
  local replacement = hs.json.encode {
    { id = event.id, timestamp = event.timestamp, duration = event.duration, data = data },
  }
  hs.http.asyncPost(M.api .. '/buckets/' .. bucket .. '/events', replacement, json, function(status, body)
    if status ~= 200 then logError('rewrite afk event ' .. event.id, status, body) end
  end)
end

local dialogHtml = [[
<!doctype html>
<meta charset="utf-8">
<style>
  :root { color-scheme: light dark; }
  body { font: 13px -apple-system, sans-serif; margin: 16px; background: Canvas; color: CanvasText; user-select: none; }
  h1 { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
  input { width: 100%; box-sizing: border-box; font: inherit; padding: 6px 8px; border-radius: 6px;
          border: 1px solid #8888; background: Field; color: FieldText; }
  .buttons { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  button { font: inherit; padding: 4px 14px; border-radius: 6px; border: 1px solid #8888; background: ButtonFace; color: ButtonText; }
  button.primary { background: AccentColor; color: AccentColorText; border-color: transparent; }
</style>
<h1>{{title}}</h1>
<input id="reason" placeholder="What were you doing? Leave empty to keep it as away" autofocus>
<div class="buttons">
  <button id="cancel">Cancel</button>
  <button id="here">I was here</button>
  <button id="save" class="primary">Save</button>
</div>
<script>
  const reason = document.getElementById('reason');
  const send = action => webkit.messageHandlers.awAway.postMessage({ action, text: reason.value });
  for (const id of ['cancel', 'here', 'save']) document.getElementById(id).onclick = () => send(id);
  document.addEventListener('keydown', e => {
    // Enter on a focused button presses that button instead
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') send('save');
    if (e.key === 'Escape') send('cancel');
  });
  window.onload = () => reason.focus();
</script>
]]

-- Shows the dialog and calls onAnswer(action, text) once, with action 'save',
-- 'here' or 'cancel' (also when the window is closed).
local function dialog(title, onAnswer)
  local answered = false
  local function finish(action, text)
    if answered then return end
    answered = true
    -- delete outside the webview's own callback
    hs.timer.doAfter(0, function()
      if M._dialog then M._dialog:delete() end
      M._dialog = nil
    end)
    onAnswer(action, text)
  end

  local content = hs.webview.usercontent.new 'awAway'
  content:setCallback(function(message) finish(message.body.action, message.body.text) end)

  local screen = hs.screen.mainScreen():frame()
  local w, h = 440, 128
  local frame = { x = screen.x + (screen.w - w) / 2, y = screen.y + screen.h / 3 - h / 2, w = w, h = h }
  M._dialog = hs.webview
    .new(frame, {}, content)
    :windowTitle('ActivityWatch')
    :windowStyle { 'titled', 'closable' }
    :level(hs.drawing.windowLevels.modalPanel)
    :allowTextEntry(true)
    :deleteOnClose(false)
    :windowCallback(function(action)
      if action == 'closing' then finish('cancel', '') end
    end)
    :html((dialogHtml:gsub('{{title}}', title)))
    :show()
  hs.focus()
  M._dialog:hswindow():focus()
end

local function ask(bucket, event)
  print(string.format('aw_away: asking about afk event %d (%ds)', event.id, math.floor(event.duration)))
  M._prompting = true
  local start = parseUtc(event.timestamp)
  local title = string.format(
    'Away for %d min (%s–%s)',
    math.floor(event.duration / 60 + 0.5),
    os.date('%H:%M', start),
    os.date('%H:%M', start + math.floor(event.duration))
  )
  dialog(title, function(action, text)
    M._prompting = false
    if action == 'here' then
      rewrite(bucket, event, { status = 'not-afk' })
    elseif action == 'save' and text and text:match '%S' then
      rewrite(bucket, event, { status = 'afk', reason = text:match '^%s*(.-)%s*$' })
    end
  end)
end
M._ask = ask -- exposed for manual testing

-- retried from poll, so a server that is down at startup is picked up later
local function fetchHost()
  hs.http.asyncGet(M.api .. '/info', nil, function(status, body)
    if status == 200 then
      M._host = hs.json.decode(body).hostname
    else
      logError('fetch info', status, body)
    end
  end)
end

local function poll()
  if M._prompting then return end
  if not M._host then return fetchHost() end
  local bucket = afkBucket()
  hs.http.asyncGet(M.api .. '/buckets/' .. bucket .. '/events?limit=5', nil, function(status, body)
    if status ~= 200 then return logError('fetch afk events', status, body) end
    local events = hs.json.decode(body) or {}
    local lastAsked = hs.settings.get(settingsKey) or 0
    -- events are newest first; skip index 1 so the watcher is done extending it
    for i = 2, #events do
      local e = events[i]
      if e.data.status == 'afk' then
        if e.data.reason then return end -- already answered
        local ended = parseUtc(e.timestamp) + e.duration
        if e.id > lastAsked and e.duration >= M.minAway and os.time() - ended <= M.maxAge then
          hs.settings.set(settingsKey, e.id)
          -- leave the HTTP callback before showing the dialog; keep a
          -- reference so the timer is not garbage collected before it fires
          M._askTimer = hs.timer.doAfter(0, function() ask(bucket, e) end)
        end
        return
      end
    end
  end)
end

function M.start()
  fetchHost()
  M._timer = hs.timer.doEvery(M.pollInterval, poll)
end

function M.stop()
  if M._timer then
    M._timer:stop()
    M._timer = nil
  end
end

return M
